# Python Setup for Template Population

## Installation

The template population feature requires Python 3 and the `python-pptx` library.

### Install Python Dependencies

```bash
pip3 install python-pptx
```

### Verify Installation

```bash
python3 -c "import pptx; print('python-pptx is installed')"
```

If you see "python-pptx is installed", you're good to go!

## How It Works

1. **User uploads template** → Stored in `uploads/templates/`
2. **User enters topic** → e.g., "Mental Health in Workplace"
3. **Claude AI generates content** → Creates 8-10 slides with titles, bullet points
4. **Python script runs** → Opens user's template, deletes existing slides, creates new slides using template's layouts, fills with AI content
5. **User downloads** → Gets presentation with THEIR design + AI content

## Features

✅ User's exact template design preserved (purple gradients, shapes, fonts, etc.)
✅ AI-generated content based on user's prompt
✅ All template formatting, colors, backgrounds maintained
✅ Professional presentations that look like the template
✅ Works with ANY .pptx template uploaded

## Troubleshooting

If you get errors about Python or python-pptx:

1. Make sure Python 3 is installed:
   ```bash
   python3 --version
   ```

2. Install python-pptx:
   ```bash
   pip3 install python-pptx
   ```

3. Make sure the script is executable:
   ```bash
   chmod +x scripts/template_populator.py
   ```

4. Test the script directly:
   ```bash
   python3 scripts/template_populator.py
   ```
   (Should show usage instructions)

