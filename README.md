# Auto Time Format Converter

A Chrome extension that automatically converts between 12-hour and 24-hour time formats on any webpage in real-time.

## Features

- ✅ **Automatic Conversion**: Converts times as pages load and update dynamically
- 🔄 **Two Modes**:
  - 24-Hour → 12-Hour (AM/PM)
  - 12-Hour (AM/PM) → 24-Hour
- ⚡ **Real-time**: Works on dynamic content and SPAs
- 🎯 **Smart Detection**: Preserves original context and formatting
- 🚀 **Performance Optimized**: Efficient DOM processing with debouncing

## Installation

### From Chrome Web Store

_(Coming soon)_

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the extension directory

## Usage

1. Click the extension icon in your Chrome toolbar
2. Select your preferred conversion mode:
   - **24-Hour → 12-Hour**: Converts times like `14:30` to `2:30 PM`
   - **12-Hour → 24-Hour**: Converts times like `2:30 PM` to `14:30`
3. Click "Apply & Reload Page"
4. The page will reload with all times converted

## Examples

### 24-Hour → 12-Hour Mode

- `09:00` → `9:00 AM`
- `14:30` → `2:30 PM`
- `23:45` → `11:45 PM`
- `00:00` → `12:00 AM`

### 12-Hour → 24-Hour Mode

- `9:00 AM` → `09:00`
- `2:30 PM` → `14:30`
- `11:45 PM` → `23:45`
- `12:00 AM` → `00:00`

## Privacy

This extension:

- ✅ Works completely offline
- ✅ Only stores your preference locally
- ✅ Does NOT collect any personal data
- ✅ Does NOT track your browsing
- ✅ Does NOT send data to external servers

## Permissions

- **Storage**: To save your conversion preference
- **Host Permissions**: To convert times on all websites you visit

## Technical Details

- **Manifest Version**: 3
- **Supported Browsers**: Chrome, Edge, Brave (Chromium-based browsers)
- **Performance**: Debounced mutation observer for optimal performance
- **Compatibility**: Works with dynamic content and single-page applications

## Development

### Project Structure

```
time-format-converter/
├── manifest.json       # Extension configuration
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── content.js          # Content script (conversion logic)
├── styles.css          # Popup styling
└── icons/              # Extension icons
```

### Building

No build process required. The extension is vanilla JavaScript.

### Testing

1. Load the extension in developer mode
2. Visit any webpage with times (e.g., news sites, schedules)
3. Toggle between conversion modes and verify output

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this extension for any purpose.

## Support

Found a bug or have a feature request? Please open an issue on GitHub.

If you find this extension helpful, consider supporting its development:

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-ffdd00?style=flat-square&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/yemzikk)

## Changelog

### Version 1.0.0

- Initial release
- 24-hour to 12-hour conversion
- 12-hour to 24-hour conversion
- Real-time conversion support
- Performance optimizations
