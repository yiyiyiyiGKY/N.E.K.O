import {
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react';
import { i18n } from './i18n';

type AvatarToolInteractionCanvasProps = {
  initialNodes?: Node[];
  initialEdges?: Edge[];
};

export function AvatarToolInteractionCanvas({
  initialNodes = [],
  initialEdges = [],
}: AvatarToolInteractionCanvasProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [ready, setReady] = useState(false);
  const ariaLabelConfig = {
    'node.a11yDescription.default': i18n(
      'chat.avatarToolWorkspaceNodeA11y',
      'Press Enter to select this interaction. Use the arrow keys to move it.',
    ),
    'edge.a11yDescription.default': i18n(
      'chat.avatarToolWorkspaceEdgeA11y',
      'Press Enter to select this connection. Press Delete to remove it.',
    ),
    'controls.ariaLabel': i18n('chat.avatarToolWorkspaceControls', 'Canvas controls'),
    'controls.zoomIn.ariaLabel': i18n('chat.avatarToolWorkspaceZoomIn', 'Zoom in'),
    'controls.zoomOut.ariaLabel': i18n('chat.avatarToolWorkspaceZoomOut', 'Zoom out'),
    'controls.fitView.ariaLabel': i18n('chat.avatarToolWorkspaceFitView', 'Fit view'),
    'minimap.ariaLabel': i18n('chat.avatarToolWorkspaceMiniMap', 'Interaction overview'),
    'handle.ariaLabel': i18n('chat.avatarToolWorkspaceHandle', 'Connection point'),
  };

  return (
    <div className="avatar-tool-workspace-canvas" data-testid="avatar-tool-workspace-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={() => setReady(true)}
        fitView
        minZoom={0.25}
        maxZoom={1.75}
        panOnScroll
        zoomOnDoubleClick={false}
        nodesFocusable
        edgesFocusable
        autoPanOnNodeFocus
        disableKeyboardA11y={false}
        ariaLabelConfig={ariaLabelConfig}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} />
        <Controls showInteractive={false} />
        {nodes.length >= 4 ? <MiniMap pannable zoomable /> : null}
      </ReactFlow>
      {nodes.length === 0 ? (
        <div className="avatar-tool-workspace-empty" aria-hidden="true">
          <span className="avatar-tool-workspace-empty-mark">⌁</span>
          <strong>{i18n('chat.avatarToolWorkspaceEmptyTitle', 'No interactions yet')}</strong>
          <p>{i18n(
            'chat.avatarToolWorkspaceEmptyBody',
            'Mouse clicks, delays, and the connections between them will appear here.',
          )}</p>
        </div>
      ) : null}
      <span className="avatar-tool-workspace-canvas-status" role="status">
        {ready
          ? i18n('chat.avatarToolWorkspaceCanvasReady', 'Canvas ready')
          : i18n('chat.avatarToolWorkspaceCanvasLoading', 'Preparing canvas…')}
      </span>
    </div>
  );
}

type AvatarToolEditorWorkspaceProps = {
  title: string;
  dialogRef: RefObject<HTMLElement>;
  backButtonRef?: RefObject<HTMLButtonElement>;
  onBack?(): void;
  showHeader?: boolean;
  onPointerDown?(event: ReactPointerEvent<HTMLElement>): void;
  onMouseDown?(event: ReactMouseEvent<HTMLElement>): void;
  children: ReactNode;
};

export default function AvatarToolEditorWorkspace({
  title,
  dialogRef,
  backButtonRef,
  onBack,
  showHeader = true,
  onPointerDown,
  onMouseDown,
  children,
}: AvatarToolEditorWorkspaceProps) {
  return (
    <section
      className="avatar-tool-editor-workspace"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={showHeader ? undefined : title}
      aria-labelledby={showHeader ? 'avatar-tool-editor-workspace-title' : undefined}
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onMouseDown={onMouseDown}
      onClick={(event) => event.stopPropagation()}
    >
      {showHeader ? (
        <header className="avatar-tool-workspace-header">
          <button
            className="avatar-tool-workspace-back"
            type="button"
            ref={backButtonRef}
            onClick={onBack}
          >
            <span aria-hidden="true">←</span>
            {i18n('chat.avatarToolCreateBack', 'Back')}
          </button>
          <div className="avatar-tool-workspace-heading">
            <span>{i18n('chat.avatarToolManagerTitle', 'Manage tools')}</span>
            <h2 id="avatar-tool-editor-workspace-title">{title}</h2>
          </div>
          <span className="avatar-tool-workspace-local-badge">
            <span aria-hidden="true">●</span>
            {i18n('chat.avatarToolWorkspaceLocalOnly', 'Saved on this device')}
          </span>
        </header>
      ) : null}

      <div className="avatar-tool-workspace-main">
        <section
          className="avatar-tool-workspace-stage"
          aria-label={i18n('chat.avatarToolWorkspaceCanvasTitle', 'Interaction flow')}
        >
          <div className="avatar-tool-workspace-stage-heading">
            <h3>{i18n('chat.avatarToolWorkspaceCanvasTitle', 'Interaction flow')}</h3>
            <p>{i18n(
              'chat.avatarToolWorkspaceCanvasHint',
              'Drag to move · Scroll to pan · Use the controls to zoom',
            )}</p>
          </div>
          <AvatarToolInteractionCanvas />
        </section>

        <aside
          className="avatar-tool-workspace-settings"
          aria-label={i18n('chat.avatarToolWorkspaceContentTitle', 'Tool content')}
        >
          <div className="avatar-tool-workspace-settings-heading">
            <h3>{i18n('chat.avatarToolWorkspaceContentTitle', 'Tool content')}</h3>
            <p className="avatar-tool-workspace-content-note">{i18n(
              'chat.avatarToolCreatePrivacy',
              'Images and sounds stay on this device; during interactions, the name and matching description are sent to the model.',
            )}</p>
          </div>
          <div className="avatar-tool-workspace-settings-body">
            {children}
          </div>
        </aside>
      </div>
    </section>
  );
}
