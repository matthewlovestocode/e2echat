"use client";

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#19d3ff",
      light: "#73ecff",
      dark: "#0088b8",
      contrastText: "#031018"
    },
    secondary: {
      main: "#b56cff",
      light: "#dfb8ff",
      dark: "#7332c9",
      contrastText: "#07010f"
    },
    background: {
      default: "#05070f",
      paper: "rgba(10, 18, 33, 0.72)"
    },
    text: {
      primary: "#eef7ff",
      secondary: "#8fa8bd"
    },
    success: {
      main: "#4dffb5"
    },
    warning: {
      main: "#ffd166"
    }
  },
  shape: {
    borderRadius: 8
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background:
            "radial-gradient(circle at 18% 12%, rgba(25, 211, 255, 0.2), transparent 30%), radial-gradient(circle at 82% 18%, rgba(181, 108, 255, 0.18), transparent 32%), linear-gradient(135deg, #05070f 0%, #07111f 52%, #05070f 100%)",
          color: "#eef7ff"
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(4, 12, 24, 0.54)",
          borderRadius: 8,
          color: "#eef7ff",
          transition: "box-shadow 160ms ease, border-color 160ms ease",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(115, 236, 255, 0.24)"
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(115, 236, 255, 0.56)"
          },
          "&.Mui-focused": {
            boxShadow: "0 0 22px rgba(25, 211, 255, 0.18)"
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#19d3ff"
          }
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#8fa8bd",
          "&.Mui-focused": {
            color: "#73ecff"
          }
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 800,
          "&.MuiButton-containedPrimary": {
            background: "linear-gradient(135deg, #19d3ff 0%, #b56cff 100%)",
            boxShadow:
              "0 0 24px rgba(25, 211, 255, 0.28), 0 0 40px rgba(181, 108, 255, 0.16)",
            "&:hover": {
              boxShadow:
                "0 0 32px rgba(25, 211, 255, 0.42), 0 0 58px rgba(181, 108, 255, 0.24)"
            }
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none"
        }
      }
    }
  }
});
