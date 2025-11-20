const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs').promises;

class PythonTemplateService {
  constructor() {
    this.outputDir = path.join(__dirname, '../../generated');
    this.pythonScript = path.join(__dirname, '../../scripts/template_populator.py');
  }

  async createPresentationFromTemplate(presentationData, templatePath) {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });

      const filename = `presentation_${Date.now()}.pptx`;
      const outputPath = path.join(this.outputDir, filename);

      if (!templatePath) {
        throw new Error('Template path is required');
      }

      // Verify template exists
      try {
        await fs.access(templatePath);
      } catch (error) {
        throw new Error(`Template file not found: ${templatePath}`);
      }

      // Prepare slides data as JSON string
      const slidesJson = JSON.stringify(presentationData.slides);

      console.log('Calling Python script with:');
      console.log('- Template:', templatePath);
      console.log('- Slides:', presentationData.slides.length);
      console.log('- Output:', outputPath);

      // Call Python script
      const options = {
        mode: 'text',
        pythonPath: 'python3',
        pythonOptions: ['-u'], // unbuffered output
        scriptPath: path.dirname(this.pythonScript),
        args: [templatePath, slidesJson, outputPath]
      };

      return new Promise((resolve, reject) => {
        PythonShell.run(path.basename(this.pythonScript), options, (err, results) => {
          if (err) {
            console.error('Python script error:', err);
            reject(new Error(`Failed to generate presentation: ${err.message}`));
            return;
          }

          if (!results || results.length === 0) {
            reject(new Error('No output from Python script'));
            return;
          }

          try {
            // Find the JSON result (usually the last line)
            let result = null;
            for (let i = results.length - 1; i >= 0; i--) {
              try {
                result = JSON.parse(results[i]);
                if (result.success !== undefined) {
                  break;
                }
              } catch (e) {
                // Not JSON, continue
              }
            }

            if (!result || result.success === undefined) {
              console.error('Python output:', results);
              reject(new Error('Invalid response from Python script'));
              return;
            }
            
            if (!result.success) {
              reject(new Error(result.error || 'Unknown error from Python script'));
              return;
            }

            console.log('Python script completed successfully');

            resolve({
              filename,
              filepath: outputPath,
              url: `/api/presentations/download/${filename}`,
            });
          } catch (parseError) {
            console.error('Failed to parse Python output:', results);
            reject(new Error('Invalid response from Python script'));
          }
        });
      });
    } catch (error) {
      console.error('Template service error:', error);
      throw error;
    }
  }
}

module.exports = new PythonTemplateService();

