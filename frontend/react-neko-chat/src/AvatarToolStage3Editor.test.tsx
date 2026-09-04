import { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import AvatarToolCreatePage from './AvatarToolCreatePage';
import AvatarToolEditorWorkspace from './AvatarToolEditorWorkspace';
import { useAvatarToolInteractionEditor } from './avatar-tools/AvatarToolInteractionEditorContext';
import type { LocalAvatarToolLimits } from './avatar-tools/localTools';

const LIMITS: LocalAvatarToolLimits = {
  maxTools: 64,
  maxNameChars: 20,
  maxMeaningChars: 100,
  maxChangeImages: 16,
  maxImageBytes: 8_388_608,
  maxImagePixels: 16_000_000,
  maxAudioBytes: 5_242_880,
  maxAudioDurationMs: 10_000,
  maxTotalBytes: 268_435_456,
};

function validPng(name: string): File {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 16, false);
  view.setUint32(20, 16, false);
  return new File([bytes], name, { type: 'image/png' });
}

let connectInitialImageToSelected: () => void = () => undefined;

function InteractionTestBridge() {
  const { state, dispatch } = useAvatarToolInteractionEditor();
  connectInitialImageToSelected = () => {
    if (state.selectedInteractionId) {
      dispatch({
        type: 'connect-initial-image',
        interactionId: state.selectedInteractionId,
      });
    }
  };
  return null;
}

function renderEditor() {
  render(
    <AvatarToolEditorWorkspace title="Create custom tool" dialogRef={createRef<HTMLElement>()}>
      <InteractionTestBridge />
      <AvatarToolCreatePage
        limits={LIMITS}
        onSpecialEnabledChange={() => undefined}
        onSave={async () => undefined}
        onCancel={() => undefined}
      />
    </AvatarToolEditorWorkspace>,
  );
}

async function addImage(file: File) {
  const expectedCount = document.querySelectorAll('[data-avatar-tool-image-id]').length + 1;
  fireEvent.change(screen.getByLabelText('Add tool image'), { target: { files: [file] } });
  await waitFor(() => expect(document.querySelectorAll('[data-avatar-tool-image-id]')).toHaveLength(expectedCount));
}

describe('avatar tool stage 3 editor', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:avatar-tool-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('uses custom names across image choices, nodes, and connection labels while keeping event types separate', async () => {
    renderEditor();
    await addImage(validPng('A.png'));
    await addImage(validPng('B.png'));

    fireEvent.click(screen.getByRole('button', { name: 'Edit Tool image 2' }));
    fireEvent.change(screen.getByLabelText('Image name'), { target: { value: 'Open palm' } });
    expect(screen.getByRole('button', { name: 'Edit Open palm' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Image name'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Edit Tool image 2' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Image name'), { target: { value: 'Open palm' } });

    fireEvent.click(screen.getByRole('button', { name: 'Mouse click' }));
    expect(Array.from(screen.getByLabelText('Release').querySelectorAll('option')).map(option => option.textContent))
      .toContain('Open palm');
    fireEvent.change(screen.getByLabelText('Interaction name'), { target: { value: 'Wave hello' } });
    expect(screen.getByText('Wave hello')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Interaction name'), { target: { value: '' } });
    expect(screen.getByText('Mouse click 1')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Interaction name'), { target: { value: 'Wave hello' } });
    expect(document.querySelector(
      '.avatar-tool-interaction-inspector-heading > div:first-child > span',
    )).toHaveTextContent('Mouse click');

    act(() => connectInitialImageToSelected());
    expect(screen.getByText('Initial image → Wave hello')).toBeVisible();
  });

  it('edits a complete mouse click and blocks deletion through its real image reference', async () => {
    renderEditor();
    await addImage(validPng('A.png'));
    await addImage(validPng('B.png'));

    fireEvent.click(screen.getByRole('button', { name: 'Mouse click' }));
    expect(screen.getByRole('tab', { name: /Interaction settings/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Mouse click 1')).toBeVisible();
    const interactionName = screen.getByLabelText('Interaction name');
    expect(interactionName).toHaveAttribute('placeholder', 'Mouse click 1');
    fireEvent.change(interactionName, { target: { value: 'Wave hello' } });
    expect(screen.getByText('Wave hello')).toBeVisible();
    expect(document.querySelector(
      '.avatar-tool-interaction-inspector-heading > div:first-child > span',
    )).toHaveTextContent('Mouse click');
    expect(document.body).not.toHaveTextContent('valid click');
    expect(document.body).not.toHaveTextContent('pointerdown');
    expect(document.body).not.toHaveTextContent('pointerup');

    const release = screen.getByLabelText('Release');
    const secondImage = Array.from(release.querySelectorAll('option'))[2];
    fireEvent.change(release, { target: { value: secondImage.value } });
    expect(screen.getByRole('img', { name: 'Tool image 2' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Delayed switch' }));
    const waitTime = screen.getByLabelText('Wait time');
    expect(waitTime).toHaveValue(800);
    expect(waitTime).toHaveAttribute('min', '1');
    expect(waitTime).toHaveAttribute('step', '1');
    fireEvent.change(waitTime, { target: { value: '1250' } });
    expect(waitTime).toHaveValue(1250);
    expect(screen.getByText('1250 ms')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Tool settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Tool image 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Wave hello · Release');
    expect(screen.getByRole('button', { name: 'Edit Tool image 2' })).toBeVisible();
  });

  it('accepts a terminal click connected from the initial image whose actions both keep the image', async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText('Tool name'), { target: { value: 'Loop' } });
    await addImage(validPng('A.png'));

    fireEvent.click(screen.getByRole('button', { name: 'Mouse click' }));
    act(() => connectInitialImageToSelected());
    expect(screen.getByText('Initial image connection')).toBeVisible();
    expect(screen.getByText('Initial image → Mouse click 1')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove connection' })).toBeVisible();
    fireEvent.click(document.querySelector('[data-avatar-tool-interaction-id]')!);
    expect(screen.getByLabelText('Press')).toHaveValue('keep');
    expect(screen.getByLabelText('Release')).toHaveValue('keep');
    expect(document.body).not.toHaveTextContent('Starting interaction');

    fireEvent.submit(document.querySelector('.avatar-tool-create-page')!);
    expect(await screen.findByText(
      'The interaction flow is valid. Saving it will be connected in the next implementation stage.',
    )).toBeVisible();
  });

  it('lets a delayed switch finish without changing the current image', async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText('Tool name'), { target: { value: 'Wait' } });
    await addImage(validPng('A.png'));

    fireEvent.click(screen.getByRole('button', { name: 'Delayed switch' }));
    const completion = screen.getByLabelText('When time is up');
    expect(completion).toHaveValue('');
    expect([...completion.querySelectorAll('option')].map(option => option.textContent))
      .toContain('Keep image');
    fireEvent.change(completion, { target: { value: 'keep' } });
    expect(completion).toHaveValue('keep');
    expect(document.querySelector('[data-avatar-tool-interaction-id]'))
      .toHaveTextContent('Keep image');

    act(() => connectInitialImageToSelected());
    fireEvent.submit(document.querySelector('.avatar-tool-create-page')!);
    expect(await screen.findByText(
      'The interaction flow is valid. Saving it will be connected in the next implementation stage.',
    )).toBeVisible();
  });

  it('marks indistinguishable clicks connected directly from the initial image', async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText('Tool name'), { target: { value: 'Branches' } });
    await addImage(validPng('A.png'));

    fireEvent.click(screen.getByRole('button', { name: 'Mouse click' }));
    act(() => connectInitialImageToSelected());
    fireEvent.click(document.querySelector('[data-avatar-tool-interaction-id]')!);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    act(() => connectInitialImageToSelected());
    fireEvent.submit(document.querySelector('.avatar-tool-create-page')!);

    expect(await screen.findByText('Fix the interaction flow before saving.')).toBeVisible();
    expect(screen.getByText('Interaction issues: 2')).toBeVisible();
    expect(screen.getByRole('button', {
      name: 'Mouse click 2 conflicts with another mouse click after the initial image appears.',
    })).toBeVisible();
    expect(document.querySelectorAll('.avatar-tool-interaction-node.has-error')).toHaveLength(2);
  });
});
