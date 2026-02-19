/**
 * React Router Configuration
 *
 * Defines all routes for the N.E.K.O web application.
 * Each management page is a standalone route (no sidebar layout).
 */

import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";

// Pages
import ApiKeySettings from "./pages/ApiKeySettings";
import CharacterManager from "./pages/CharacterManager";
import VoiceClone from "./pages/VoiceClone";
import MemoryBrowser from "./pages/MemoryBrowser";
import SteamWorkshop from "./pages/SteamWorkshop";
import ModelManager from "./pages/ModelManager";
import Live2DParameterEditor from "./pages/Live2DParameterEditor";
import Live2DEmotionManager from "./pages/Live2DEmotionManager";
import VRMEmotionManager from "./pages/VRMEmotionManager";
import Subtitle from "./pages/Subtitle";
import Viewer from "./pages/Viewer";

/**
 * Wrapper component for App with default props
 */
function AppWrapper() {
  const handleLanguageChange = async (lng: "zh-CN" | "en") => {
    console.log("[AppWrapper] Language change requested:", lng);
    // TODO: Implement language change with i18n context
  };

  return <App language="zh-CN" onChangeLanguage={handleLanguageChange} />;
}

/**
 * Router configuration
 * Each page is standalone with its own header bar and close button.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppWrapper />,
  },
  {
    path: "/demo",
    element: <AppWrapper />,
  },
  {
    path: "/api_key",
    element: <ApiKeySettings />,
  },
  {
    path: "/chara_manager",
    element: <CharacterManager />,
  },
  {
    path: "/voice_clone",
    element: <VoiceClone />,
  },
  {
    path: "/memory_browser",
    element: <MemoryBrowser />,
  },
  {
    path: "/steam_workshop_manager",
    element: <SteamWorkshop />,
  },
  {
    path: "/model_manager",
    element: <ModelManager />,
  },
  {
    path: "/l2d",
    element: <Live2DEmotionManager />,
  },
  {
    path: "/live2d_emotion_manager",
    element: <Live2DEmotionManager />,
  },
  {
    path: "/live2d_parameter_editor",
    element: <Live2DParameterEditor />,
  },
  {
    path: "/vrm_emotion_manager",
    element: <VRMEmotionManager />,
  },
  {
    path: "/subtitle",
    element: <Subtitle />,
  },
  {
    path: "/viewer",
    element: <Viewer />,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default router;
