import { createContext, useContext } from "react";
import { LIGHT } from "../lib/constants";

export const ThemeCtx = createContext(LIGHT);
export const useTheme = () => useContext(ThemeCtx);
