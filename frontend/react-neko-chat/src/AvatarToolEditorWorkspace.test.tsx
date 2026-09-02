import { render, screen } from '@testing-library/react';
import { AvatarToolInteractionCanvas } from './AvatarToolEditorWorkspace';

describe('AvatarToolEditorWorkspace', () => {
  it('provides localized viewport controls, keyboard-focusable content, and an on-demand minimap', () => {
    render(
      <AvatarToolInteractionCanvas
        initialNodes={[
          { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' }, initialWidth: 160, initialHeight: 64 },
          { id: 'b', position: { x: 260, y: 0 }, data: { label: 'B' }, initialWidth: 160, initialHeight: 64 },
          { id: 'c', position: { x: 0, y: 160 }, data: { label: 'C' }, initialWidth: 160, initialHeight: 64 },
          { id: 'd', position: { x: 260, y: 160 }, data: { label: 'D' }, initialWidth: 160, initialHeight: 64 },
        ]}
        initialEdges={[{ id: 'a-b', source: 'a', target: 'b' }]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fit view' })).toBeInTheDocument();
    expect(screen.getByLabelText('Interaction overview')).toBeInTheDocument();
    expect(document.querySelector('.react-flow__node[data-id="a"]')).toHaveAttribute('tabindex', '0');
    expect(document.querySelector('[id^="react-flow__edge-desc-"]')).toHaveTextContent(
      'Press Enter to select this connection. Press Delete to remove it.',
    );
  });
});
