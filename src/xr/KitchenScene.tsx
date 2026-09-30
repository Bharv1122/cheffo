import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { Group, Vector3 } from 'three';
import type { Recipe, UnitPreference } from '../types/recipe';
import { formatIngredientByPreference } from '../utils/calculator';
import { formatClock, ingredientLine, timerRemainingMs, type KitchenState } from '../kitchen/stepEngine';
import type { VoiceStatus } from '../kitchen/useKitchenSession';
import { Button3D, Panel } from './ui3d';
import { ui, type TextLine } from './ui3dCore';

export type Posture = 'seated' | 'standing';

export interface KitchenSceneActions {
  next: () => void;
  back: () => void;
  repeat: () => void;
  startStepTimer: () => void;
  addTimer: (minutes: number) => void;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string) => void;
  cancelTimer: (id: string) => void;
  setPosture: (posture: Posture) => void;
  recenter: () => void;
  toggleVoice: () => void;
  exit: () => void;
}

export interface KitchenSceneProps {
  recipe: Recipe;
  isSample: boolean;
  state: KitchenState;
  now: number;
  stepMinutes: number | null;
  unitPreference: UnitPreference;
  posture: Posture;
  recenterKey: number;
  voice: VoiceStatus;
  voiceNote: string;
  actions: KitchenSceneActions;
}

// Seated use keeps everything closer and lower, within a comfortable reach
// envelope for poking without leaning; standing moves it out to counter height.
const LAYOUT: Record<Posture, { distance: number; drop: number; tilt: number }> = {
  seated: { distance: 0.55, drop: 0.2, tilt: -0.12 },
  standing: { distance: 0.72, drop: 0.25, tilt: 0 },
};

// Scratch vectors for the recenter math (one scene per page).
const headPosition = new Vector3();
const headForward = new Vector3();

// Places the kitchen in front of the user whenever a session starts, the
// posture changes or they press Recenter (HAL's useRecenter pattern).
function useRecenter(posture: Posture, key: number) {
  const root = useRef<Group>(null);
  const session = useXR(s => s.session);
  const { gl, camera } = useThree();
  const pending = useRef(0);
  useEffect(() => {
    pending.current = session ? 20 : 0;
    if (!session && root.current) {
      root.current.position.set(0, 1.25, -LAYOUT[posture].distance);
      root.current.rotation.set(0, 0, 0);
    }
  }, [session, posture, key]);
  useFrame(() => {
    if (!pending.current || !root.current) return;
    if (--pending.current > 0) return;
    const cam = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    cam.getWorldPosition(headPosition);
    cam.getWorldDirection(headForward);
    headForward.y = 0;
    if (headForward.lengthSq() < 1e-4) headForward.set(0, 0, -1);
    headForward.normalize();
    const layout = LAYOUT[posture];
    root.current.position.copy(headPosition).addScaledVector(headForward, layout.distance);
    root.current.position.y = headPosition.y - layout.drop;
    root.current.rotation.set(0, Math.atan2(-headForward.x, -headForward.z), 0);
  });
  return root;
}

function StepPanel({ recipe, isSample, state }: Pick<KitchenSceneProps, 'recipe' | 'isSample' | 'state'>) {
  const step = recipe.instructions[state.step];
  const lines: TextLine[] = [
    { text: `STEP ${state.step + 1} OF ${recipe.instructions.length}${isSample ? '  ·  SAMPLE DATA' : ''}`, size: 0.02, bold: true, color: ui.amber },
    { text: step?.instruction ?? '', size: 0.034, bold: true, gapBefore: 0.012 },
  ];
  if (step?.tip) lines.push({ text: `Tip: ${step.tip}`, size: 0.021, color: ui.muted, gapBefore: 0.014 });
  return <Panel w={0.6} h={0.36} lines={lines} />;
}

function IngredientsPanel({ recipe, unitPreference }: Pick<KitchenSceneProps, 'recipe' | 'unitPreference'>) {
  const size = recipe.ingredients.length > 9 ? 0.016 : 0.019;
  const lines: TextLine[] = [
    { text: 'INGREDIENTS', size: 0.018, bold: true, color: ui.amber },
    ...recipe.ingredients.map((ing, i) => ({ text: ingredientLine(ing.name, formatIngredientByPreference(ing, unitPreference)), size, gapBefore: i ? 0.004 : 0.01 })),
  ];
  return <Panel w={0.36} h={0.46} lines={lines} />;
}

function TimersPanel({ state, now, actions }: Pick<KitchenSceneProps, 'state' | 'now' | 'actions'>) {
  const timers = state.timers.slice(0, 4);
  return (
    <Panel w={0.36} h={0.46} lines={[
      { text: 'TIMERS', size: 0.018, bold: true, color: ui.amber },
      ...(timers.length ? [] : [{ text: 'No timers running. Start one from the controls below the step.', size: 0.018, color: ui.muted, gapBefore: 0.01 }]),
    ]}>
      {timers.map((timer, i) => {
        const y = 0.13 - i * 0.1;
        const paused = timer.endsAt === null && !timer.done;
        const clock = timer.done ? 'Done!' : `${formatClock(timerRemainingMs(timer, now))}${paused ? ' (paused)' : ''}`;
        return (
          <group key={timer.id} position={[0, y, 0.002]}>
            <Panel w={0.33} h={0.088} color={timer.done ? ui.accent : ui.raised} border={timer.done ? ui.amber : ui.line}
              lines={[{ text: timer.label, size: 0.014, color: timer.done ? '#fff' : ui.muted }, { text: clock, size: 0.03, bold: true }]}>
              {!timer.done && (
                <Button3D w={0.075} h={0.05} size={0.016} position={[0.065, 0, 0.004]} label={paused ? 'Resume' : 'Pause'}
                  onPress={() => (paused ? actions.resumeTimer(timer.id) : actions.pauseTimer(timer.id))} />
              )}
              <Button3D w={0.06} h={0.05} size={0.016} position={[0.135, 0, 0.004]} label={timer.done ? 'OK' : 'Stop'} onPress={() => actions.cancelTimer(timer.id)} />
            </Panel>
          </group>
        );
      })}
    </Panel>
  );
}

function Dock({ state, recipe, stepMinutes, actions }: Pick<KitchenSceneProps, 'state' | 'recipe' | 'stepMinutes' | 'actions'>) {
  const last = state.step >= recipe.instructions.length - 1;
  return (
    <Panel w={0.6} h={0.2}>
      <Button3D w={0.17} h={0.075} size={0.026} position={[-0.195, 0.045, 0]} label="Back" disabled={state.step === 0} onPress={actions.back} name="xr-back" />
      <Button3D w={0.15} h={0.075} size={0.026} position={[-0.02, 0.045, 0]} label="Repeat" onPress={actions.repeat} name="xr-repeat" />
      <Button3D w={0.2} h={0.075} size={0.028} position={[0.175, 0.045, 0]} label={last ? 'Finish' : 'Next'} primary onPress={last ? actions.exit : actions.next} name="xr-next" />
      {stepMinutes
        ? <Button3D w={0.25} h={0.06} size={0.019} position={[-0.155, -0.05, 0]} label={`Start ${stepMinutes}-min timer`} onPress={actions.startStepTimer} name="xr-step-timer" />
        : <Button3D w={0.25} h={0.06} size={0.017} position={[-0.155, -0.05, 0]} label="No set time for this step" disabled onPress={() => {}} />}
      <Button3D w={0.1} h={0.06} size={0.019} position={[0.045, -0.05, 0]} label="+1 min" onPress={() => actions.addTimer(1)} />
      <Button3D w={0.1} h={0.06} size={0.019} position={[0.155, -0.05, 0]} label="+5 min" onPress={() => actions.addTimer(5)} name="xr-plus5" />
      <Button3D w={0.06} h={0.06} size={0.017} position={[0.24, -0.05, 0]} label="+10" onPress={() => actions.addTimer(10)} />
    </Panel>
  );
}

function TopBar({ posture, voice, actions, inSession }: Pick<KitchenSceneProps, 'posture' | 'voice' | 'actions'> & { inSession: boolean }) {
  return (
    <group>
      <Button3D w={0.13} h={0.05} size={0.017} position={[-0.225, 0, 0]} label={posture === 'seated' ? 'Seated ✓' : 'Seated'} active={posture === 'seated'} onPress={() => actions.setPosture('seated')} />
      <Button3D w={0.13} h={0.05} size={0.017} position={[-0.085, 0, 0]} label={posture === 'standing' ? 'Standing ✓' : 'Standing'} active={posture === 'standing'} onPress={() => actions.setPosture('standing')} />
      <Button3D w={0.12} h={0.05} size={0.017} position={[0.05, 0, 0]} label="Recenter" onPress={actions.recenter} />
      {voice !== 'unsupported' && (
        <Button3D w={0.1} h={0.05} size={0.017} position={[0.165, 0, 0]} label={voice === 'listening' ? 'Mic on' : 'Voice'} active={voice === 'listening'} onPress={actions.toggleVoice} />
      )}
      {inSession && <Button3D w={0.08} h={0.05} size={0.017} position={[0.26, 0, 0]} label="Exit" onPress={actions.exit} name="xr-exit" />}
    </group>
  );
}

export default function KitchenScene(props: KitchenSceneProps) {
  const mode = useXR(s => s.mode);
  const session = useXR(s => s.session);
  const root = useRecenter(props.posture, props.recenterKey);
  const tilt = LAYOUT[props.posture].tilt;
  return (
    <>
      {mode !== 'immersive-ar' && <color attach="background" args={['#14110f']} />}
      <ambientLight intensity={1} />
      <group ref={root} position={[0, 1.25, -LAYOUT[props.posture].distance]}>
        <group rotation={[tilt, 0, 0]}>
          <group position={[0, 0.28, 0]}><TopBar posture={props.posture} voice={props.voice} actions={props.actions} inSession={!!session} /></group>
          <StepPanel recipe={props.recipe} isSample={props.isSample} state={props.state} />
          <group position={[0, -0.3, 0.05]} rotation={[-0.45, 0, 0]}>
            <Dock state={props.state} recipe={props.recipe} stepMinutes={props.stepMinutes} actions={props.actions} />
          </group>
          <group position={[-0.5, 0, 0.1]} rotation={[0, 0.5, 0]}><IngredientsPanel recipe={props.recipe} unitPreference={props.unitPreference} /></group>
          <group position={[0.5, 0, 0.1]} rotation={[0, -0.5, 0]}><TimersPanel state={props.state} now={props.now} actions={props.actions} /></group>
          {props.voiceNote && props.voice !== 'off' && (
            <Panel w={0.6} h={0.05} position={[0, -0.45, 0.12]} rotation={[-0.45, 0, 0]} color="#2a1606" border={ui.accent}
              lines={[{ text: props.voiceNote, size: 0.016, align: 'center' }]} />
          )}
          <Panel w={0.6} h={0.04} position={[0, 0.215, 0]} color="#14110f" border="#14110f"
            lines={[{ text: 'Educational guidance, not veterinary advice. Check with your veterinarian before changing your dog’s diet.', size: 0.0125, color: ui.muted, align: 'center' }]} />
        </group>
      </group>
    </>
  );
}
