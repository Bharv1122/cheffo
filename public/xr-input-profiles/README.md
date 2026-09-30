# WebXR input profile assets (self-hosted)

Copied unmodified from `@webxr-input-profiles/assets` 1.0.20 (MIT, see LICENSE.md): the
generic hand model plus Quest 3/3S (meta-quest-touch-plus) and Quest 2 (oculus-touch-v3)
controller models. `profilesList.json` is trimmed to those three.

Served from this origin because the site CSP (`connect-src 'self'`) blocks the
@react-three/xr default CDN. Used by `src/xr/KitchenXR.tsx` (`baseAssetPath`).
