const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs').promises;
const { getGeminiModel } = require('../config/gemini');
const pdfParse = require('pdf-parse');
const csv = require('csv-parser');
const { createReadStream } = require('fs');

class ExcelService {
  constructor() {
    this.outputDir = path.join(__dirname, '../../generated/excel');
  }

  // NEW METHOD: Generate Excel from CSV
  async generateExcelFromCSV(filePath, options = {}) {
    try {
      console.log('📊 Processing CSV file...');

      // Read and parse CSV
      const csvData = await this.parseCSVFile(filePath);

      if (!csvData || csvData.length === 0) {
        throw new Error('No data found in CSV file');
      }

      console.log(`✅ Parsed ${csvData.length} rows from CSV`);

      // If organizeData option is true, use AI to enhance/organize
      if (options.organizeData) {
        console.log('🤖 Using AI to organize and enhance CSV data...');
        return await this.enhanceCSVWithAI(csvData, options);
      } else {
        // Direct conversion without AI
        console.log('📋 Converting CSV directly to Excel...');
        return await this.convertCSVToExcel(csvData, options);
      }
    } catch (error) {
      console.error('CSV to Excel error:', error);
      throw new Error('Failed to generate Excel from CSV: ' + error.message);
    }
  }

  async parseCSVFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];

      createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  async convertCSVToExcel(csvData, options) {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });

      const workbook = XLSX.utils.book_new();

      // Create worksheet from CSV data
      const worksheet = XLSX.utils.json_to_sheet(csvData);

      // Auto-size columns
      const columns = Object.keys(csvData[0] || {});
      const wscols = columns.map(col => ({ wch: 15 }));
      worksheet['!cols'] = wscols;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

      const filename = `excel_${Date.now()}.xlsx`;
      const filepath = path.join(this.outputDir, filename);

      XLSX.writeFile(workbook, filepath);

      console.log('✅ Excel file created from CSV:', filename);

      return {
        filename,
        filepath,
        url: `/api/excel/download/${filename}`,
        metadata: {
          title: 'Converted from CSV',
          description: `${csvData.length} rows imported`,
          rowCount: csvData.length,
          columnCount: columns.length,
        },
      };
    } catch (error) {
      console.error('CSV conversion error:', error);
      throw error;
    }
  }

  async enhanceCSVWithAI(csvData, options) {
    try {
      console.log('🤖 Enhancing CSV data with Gemini AI...');

      // Convert CSV data to string representation for AI
      const csvPreview = csvData.slice(0, 100); // Send first 100 rows to AI
      const csvString = JSON.stringify(csvPreview, null, 2);

      const model = getGeminiModel('gemini-1.5-pro');

      const prompt = `You are a data analyst. Analyze this CSV data and enhance it by:
1. Cleaning and standardizing column names
2. Detecting data types correctly
3. Adding calculated columns if appropriate
4. Organizing data logically
5. Adding summary statistics if relevant

ORIGINAL CSV DATA (first 100 rows):
${csvString}

TOTAL ROWS: ${csvData.length}

Create an enhanced version with:
- Clean, professional column names
- Proper data types
- Additional calculated fields where useful
- Summary sheet with statistics

Respond with ONLY valid JSON in this format:
{
  "sheets": [
    {
      "name": "Main Data",
      "data": [/* enhanced data rows */]
    },
    {
      "name": "Summary",
      "data": [/* summary statistics */]
    }
  ],
  "metadata": {
    "title": "Enhanced CSV Data",
    "description": "Brief description of the data",
    "rowCount": ${csvData.length},
    "improvements": ["List of improvements made"]
  }
}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const enhancedData = this.parseGeminiResponse(text);

      // Merge AI enhancements with full dataset
      // Use AI structure but include all original rows
      if (enhancedData.sheets && enhancedData.sheets.length > 0) {
        const mainSheet = enhancedData.sheets[0];

        // If AI only processed sample, merge with full data
        if (csvData.length > csvPreview.length) {
          console.log('📋 Applying AI structure to full dataset...');
          const columnMapping = this.createColumnMapping(csvPreview[0], mainSheet.data[0]);
          const fullData = csvData.map(row => this.transformRow(row, columnMapping));
          enhancedData.sheets[0].data = fullData;
        }
      }

      return await this.createExcelFile(enhancedData, options);
    } catch (error) {
      console.error('AI enhancement error:', error);
      // Fallback to direct conversion if AI fails
      console.log('⚠️  Falling back to direct conversion');
      return await this.convertCSVToExcel(csvData, options);
    }
  }

  createColumnMapping(originalRow, enhancedRow) {
    const mapping = {};
    const originalCols = Object.keys(originalRow);
    const enhancedCols = Object.keys(enhancedRow);

    // Simple mapping based on position
    originalCols.forEach((col, index) => {
      mapping[col] = enhancedCols[index] || col;
    });

    return mapping;
  }

  transformRow(originalRow, columnMapping) {
    const transformed = {};
    Object.keys(originalRow).forEach(key => {
      const newKey = columnMapping[key] || key;
      transformed[newKey] = originalRow[key];
    });
    return transformed;
  }

  // NEW METHOD: Generate Excel from uploaded PDF
  async generateExcelFromPDF(filePath, options = {}) {
    try {
      console.log('📄 Extracting data from PDF...');

      // Extract text from PDF
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      const pdfText = pdfData.text;

      if (!pdfText || pdfText.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }

      console.log(`✅ Extracted ${pdfText.length} characters from PDF`);

      // Use Gemini to analyze and structure the data
      console.log('🤖 Analyzing PDF data with Gemini AI...');
      const model = getGeminiModel('gemini-1.5-pro');

      const prompt = this.buildPDFExtractionPrompt(pdfText, options);

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('✅ AI analysis complete');

      // Parse the structured response
      const excelData = this.parseGeminiResponse(text);

      // Create Excel file
      const fileInfo = await this.createExcelFile(excelData, options);

      return fileInfo;
    } catch (error) {
      console.error('PDF to Excel error:', error);
      throw new Error('Failed to generate Excel from PDF: ' + error.message);
    }
  }

  buildPDFExtractionPrompt(pdfText, options) {
    return `You are a data extraction expert. Analyze this PDF content and organize it into a structured Excel spreadsheet format.

PDF CONTENT:

${pdfText.substring(0, 10000)} ${pdfText.length > 10000 ? '[Content truncated...]' : ''}

TASK: Extract and organize ALL data from this PDF into a logical table format.

INSTRUCTIONS:

1. Identify all data points, tables, lists, and structured information
2. Create appropriate column headers
3. Organize data into rows
4. Clean and format the data properly
5. Remove any duplicate or irrelevant information
6. If the PDF contains multiple tables, create separate sheets for each

${options.extractTables ? 'Focus specifically on extracting tables and tabular data.' : ''}
${options.includeMetadata ? 'Include metadata like dates, sources, references in a separate sheet.' : ''}

RESPOND WITH ONLY VALID JSON IN THIS EXACT FORMAT:

{
  "sheets": [
    {
      "name": "Main Data",
      "data": [
        {
          "Column1": "value1",
          "Column2": "value2",
          "Column3": "value3"
        },
        {
          "Column1": "value4",
          "Column2": "value5",
          "Column3": "value6"
        }
      ]
    }
  ],
  "metadata": {
    "title": "Extracted from PDF",
    "description": "Brief description of the data",
    "rowCount": 10,
    "columnCount": 5
  }
}

CRITICAL RULES:

1. Extract ALL relevant data from the PDF
2. Use clear, descriptive column names
3. Ensure data types are appropriate (numbers as numbers, dates as dates)
4. NO MARKDOWN, NO CODE BLOCKS - ONLY JSON
5. If no structured data is found, create a summary table

Generate the structured Excel data now:`;
  }

  async generateExcelFromPrompt(userPrompt, options = {}) {
    try {
      console.log('🤖 Generating Excel with Gemini AI...');

      const model = getGeminiModel('gemini-1.5-pro');

      const prompt = this.buildExcelPrompt(userPrompt, options);

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('✅ Gemini response received');

      // Parse the JSON response
      const excelData = this.parseGeminiResponse(text);

      // Create Excel file
      const fileInfo = await this.createExcelFile(excelData, options);

      return fileInfo;
    } catch (error) {
      console.error('Excel generation error:', error);
      throw new Error('Failed to generate Excel file: ' + error.message);
    }
  }

  buildExcelPrompt(userPrompt, options) {
    return `You are an expert data analyst. Generate structured, realistic data for an Excel spreadsheet.

USER REQUEST: ${userPrompt}

REQUIREMENTS:

${options.rows ? `- Generate exactly ${options.rows} rows of data` : '- Generate 15-25 rows of realistic data'}
${options.includeCharts ? '- Include chart recommendations' : ''}
${options.includeFormulas ? '- Include Excel formulas where appropriate' : ''}

RESPOND WITH ONLY VALID JSON IN THIS EXACT FORMAT:

{
  "sheets": [
    {
      "name": "Sheet1",
      "data": [
        {
          "Column1": "value1",
          "Column2": 100,
          "Column3": "2024-01-01"
        }
      ],
      "formulas": [
        {
          "cell": "D2",
          "formula": "=B2*C2"
        }
      ],
      "charts": [
        {
          "type": "bar",
          "title": "Chart Title",
          "dataRange": "A1:C10"
        }
      ]
    }
  ],
  "metadata": {
    "title": "Spreadsheet Title",
    "description": "Brief description"
  }
}

CRITICAL RULES:

1. Generate REALISTIC, DIVERSE data (not repetitive)
2. Use appropriate data types (numbers, text, dates, percentages)
3. Column names must be clear and professional
4. Add formulas for calculations (SUM, AVERAGE, IF, etc.)
5. NO MARKDOWN, NO CODE BLOCKS - ONLY JSON
6. Make data look professional and authentic

Generate the Excel data now:`;
  }

  parseGeminiResponse(responseText) {
    try {
      // Clean response
      let cleaned = responseText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      // Find JSON object
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON found in response');
      }

      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

      const data = JSON.parse(cleaned);

      // Validate structure
      if (!data.sheets || !Array.isArray(data.sheets)) {
        throw new Error('Invalid data structure: missing sheets array');
      }

      if (data.sheets.length === 0) {
        throw new Error('No sheets generated');
      }

      return data;
    } catch (error) {
      console.error('Parse error:', error);
      console.error('Response preview:', responseText.substring(0, 500));
      throw new Error('Failed to parse AI response. Please try again.');
    }
  }

  async createExcelFile(excelData, options = {}) {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Add each sheet
      for (const sheetData of excelData.sheets) {
        if (!sheetData.data || sheetData.data.length === 0) {
          console.warn(`Sheet "${sheetData.name}" has no data, skipping`);
          continue;
        }

        // Convert data to worksheet
        const worksheet = XLSX.utils.json_to_sheet(sheetData.data);

        // Apply formulas if present
        if (sheetData.formulas && sheetData.formulas.length > 0) {
          sheetData.formulas.forEach(formula => {
            if (formula.cell && formula.formula) {
              worksheet[formula.cell] = { f: formula.formula };
            }
          });
        }

        // Add worksheet to workbook
        const sheetName = (sheetData.name || 'Sheet1').substring(0, 31); // Excel limit
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }

      // Generate filename
      const filename = `excel_${Date.now()}.xlsx`;
      const filepath = path.join(this.outputDir, filename);

      // Write file
      XLSX.writeFile(workbook, filepath);

      console.log('✅ Excel file created:', filename);

      return {
        filename,
        filepath,
        url: `/api/excel/download/${filename}`,
        metadata: excelData.metadata || {},
      };
    } catch (error) {
      console.error('Excel file creation error:', error);
      throw new Error('Failed to create Excel file: ' + error.message);
    }
  }
}

module.exports = new ExcelService();
