#!/bin/bash

# Create images directory if it doesn't exist
mkdir -p images

# Basic SVG icon with "PM" text in a circle
cat > images/icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <circle cx="64" cy="64" r="60" fill="#4285f4" />
  <text x="64" y="78" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white">PM</text>
  <path d="M32,32 L96,96 M96,32 L32,96" stroke="white" stroke-width="8" stroke-linecap="round" opacity="0.3" />
</svg>
EOF

# Check if ImageMagick is installed
if command -v convert &> /dev/null; then
    # Convert SVG to PNG files of different sizes
    convert -background none images/icon.svg -resize 16x16 images/icon16.png
    convert -background none images/icon.svg -resize 48x48 images/icon48.png
    convert -background none images/icon.svg -resize 128x128 images/icon128.png
    
    # Create a screenshot placeholder for docs
    convert -size 800x600 -background "#f5f5f5" -fill "#4285f4" -font Arial -pointsize 32 -gravity center label:"postMessage DevTools\n\nScreenshot Placeholder" docs/screenshot.png
    
    echo "Icons and placeholder screenshot created successfully!"
else
    echo "ImageMagick not found. Please install it or manually create the icon files."
    echo "You need to create the following files:"
    echo "- images/icon16.png (16x16)"
    echo "- images/icon48.png (48x48)"
    echo "- images/icon128.png (128x128)"
    echo "- docs/screenshot.png (any size, for README)"
fi 