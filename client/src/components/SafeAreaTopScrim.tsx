// Local replacement for the Space SDK's SafeAreaTopScrim.
//
// Renders an inert bar exactly as tall as the device's top safe-area inset
// (notch / status bar) in the given background colour, so the app's own
// header never slides under the system chrome on mobile.
export function SafeAreaTopScrim({ backgroundColor }: { backgroundColor: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "env(safe-area-inset-top, 0px)",
        backgroundColor,
        zIndex: 60,
        pointerEvents: "none",
      }}
    />
  );
}
