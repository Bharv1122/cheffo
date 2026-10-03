// Hands-first 3D UI for the WebXR kitchen. Patterns follow the HAL project's
// src/xr/ui3d.tsx (rounded panels, buttons that answer a mouse click, a pinch
// ray or a finger poke, with a press-in animation). Text is drawn to a 2D
// canvas texture instead of troika/drei <Text>: that needs no font download
// and no blob: worker, both of which the site's Content-Security-Policy blocks.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { makeTextTexture, roundedRect, ui, type TextLine, type V3 } from './ui3dCore';

// One texture per distinct content; the previous one is freed on change.
function useTextTexture(w: number, h: number, lines: TextLine[], padding = 0.02) {
  const key = JSON.stringify(lines);
  const texture = useMemo(() => makeTextTexture(w, h, JSON.parse(key) as TextLine[], padding), [w, h, key, padding]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

export function Panel({ w, h, position, rotation, color = ui.panel, border = ui.line, lines, children }: {
  w: number; h: number; position?: V3; rotation?: V3; color?: string; border?: string; lines?: TextLine[]; children?: ReactNode;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={roundedRect(w + 0.006, h + 0.006, 0.022)} position={[0, 0, -0.0015]}>
        <meshBasicMaterial color={border} toneMapped={false} />
      </mesh>
      <mesh geometry={roundedRect(w, h, 0.02)}>
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.97} />
      </mesh>
      {lines && <PanelText w={w} h={h} lines={lines} />}
      {children}
    </group>
  );
}

function PanelText({ w, h, lines }: { w: number; h: number; lines: TextLine[] }) {
  const texture = useTextTexture(w, h, lines);
  return (
    <mesh position={[0, 0, 0.001]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

// A button that responds to a pinch-ray, a finger poke or a mouse click. Kept
// large (≥ 4 cm tall) so a poke lands reliably with hand tracking.
export function Button3D({ w, h, label, onPress, position, primary, active, disabled, size = 0.02, name }: {
  w: number; h: number; label: string; onPress: () => void; position?: V3; primary?: boolean; active?: boolean; disabled?: boolean; size?: number; name?: string;
}) {
  const [hover, setHover] = useState(0);
  const face = useRef<Group>(null);
  const pressed = useRef(0);
  const downPointers = useRef(new Set<number>());
  useFrame((_, dt) => {
    if (!face.current) return;
    pressed.current = Math.max(0, pressed.current - dt * 4);
    face.current.position.z = -0.006 * Math.min(1, pressed.current * 2);
  });
  const fill = disabled ? ui.raised : primary ? ui.accent : active || hover ? ui.hover : ui.raised;
  const border = primary ? ui.accent : active || hover ? ui.amber : ui.line;
  const ink = disabled ? '#6b625b' : primary ? ui.accentInk : ui.text;
  const texture = useTextTexture(w, h, [{ text: label, size, bold: true, color: ink, align: 'center', gapBefore: h / 2 - size * 0.55 - 0.02 }], 0.02);
  return (
    <group position={position} name={name}>
      <group ref={face}>
        <mesh geometry={roundedRect(w + 0.004, h + 0.004, 0.012)} position={[0, 0, 0.0005]}>
          <meshBasicMaterial color={border} toneMapped={false} />
        </mesh>
        <mesh
          geometry={roundedRect(w, h, 0.011)}
          position={[0, 0, 0.001]}
          onPointerEnter={() => setHover(v => v + 1)}
          onPointerLeave={e => {
            setHover(v => Math.max(0, v - 1));
            downPointers.current.delete(e.pointerId);
          }}
          // Press on release rather than `click`: the library only emits
          // `click` for down→up under ~300 ms, so a slow, deliberate pinch or
          // poke would silently do nothing.
          onPointerDown={e => {
            e.stopPropagation();
            downPointers.current.add(e.pointerId);
          }}
          onPointerUp={e => {
            e.stopPropagation();
            if (!downPointers.current.delete(e.pointerId) || disabled) return;
            pressed.current = 1;
            onPress();
          }}
        >
          <meshBasicMaterial color={fill} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
