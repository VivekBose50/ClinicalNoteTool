import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // A clean, "medical UI" friendly stack: neutral, highly legible, widely available.
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Segoe UI"',
          "Inter",
          '"Source Sans 3"',
          '"IBM Plex Sans"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          '"Noto Sans"',
          '"Liberation Sans"',
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;


