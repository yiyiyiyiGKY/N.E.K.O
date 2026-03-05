/**
 * React Router Configuration
 *
 * Defines all routes for the N.E.K.O web application.
 * Uses lazy loading for page components to reduce initial bundle size.
 */

import { lazy, Suspense, type LazyExoticComponent, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";

// Lazy load page components for better performance
// Each page is loaded only when user navigates to that route
const ApiKeySettings = lazy(() => import("./pages/ApiKeySettings"));
const CharacterManager = lazy(() => import("./pages/CharacterManager"));
const VoiceClone = lazy(() => import("./pages/VoiceClone"));
const MemoryBrowser = lazy(() => import("./pages/MemoryBrowser"));
const SteamWorkshop = lazy(() => import("./pages/SteamWorkshop"));
const ModelManager = lazy(() => import("./pages/ModelManager"));
const Live2DParameterEditor = lazy(() => import("./pages/Live2DParameterEditor"));
const Live2DEmotionManager = lazy(() => import("./pages/Live2DEmotionManager"));
const VRMEmotionManager = lazy(() => import("./pages/VRMEmotionManager"));
const Subtitle = lazy(() => import("./pages/Subtitle"));
const Viewer = lazy(() => import("./pages/Viewer"));

/**
 * Loading fallback component
 */
function PageLoader() {
  return (
    <div className="neko-container">
      <div className="neko-loading">
        <div className="neko-loading-spinner"></div>
        <p className="neko-loading-text">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Wrapper for lazy loaded components with Suspense
 */
function LazyPage({ component: Component }: { component: LazyExoticComponent<() => ReactNode> }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
}

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
 * Uses lazy loading to reduce initial bundle size.
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
    element: <LazyPage component={ApiKeySettings} />,
  },
  {
    path: "/chara_manager",
    element: <LazyPage component={CharacterManager} />,
  },
  {
    path: "/voice_clone",
    element: <LazyPage component={VoiceClone} />,
  },
  {
    path: "/memory_browser",
    element: <LazyPage component={MemoryBrowser} />,
  },
  {
    path: "/steam_workshop_manager",
    element: <LazyPage component={SteamWorkshop} />,
  },
  {
    path: "/model_manager",
    element: <LazyPage component={ModelManager} />,
  },
  {
    path: "/l2d",
    element: <LazyPage component={Live2DEmotionManager} />,
  },
  {
    path: "/live2d_emotion_manager",
    element: <LazyPage component={Live2DEmotionManager} />,
  },
  {
    path: "/live2d_parameter_editor",
    element: <LazyPage component={Live2DParameterEditor} />,
  },
  {
    path: "/vrm_emotion_manager",
    element: <LazyPage component={VRMEmotionManager} />,
  },
  {
    path: "/subtitle",
    element: <LazyPage component={Subtitle} />,
  },
  {
    path: "/viewer",
    element: <LazyPage component={Viewer} />,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default router;
