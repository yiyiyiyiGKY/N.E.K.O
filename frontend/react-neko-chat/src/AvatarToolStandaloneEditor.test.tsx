import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AvatarToolStandaloneEditor from './AvatarToolStandaloneEditor';

const LOCAL_ID = 'local-12345678-1234-4123-8123-123456789abc' as const;
const catalog = vi.hoisted(() => ({
  limits: {
    maxTools: 64,
    maxNameChars: 20,
    maxMeaningChars: 100,
    maxChangeImages: 16,
    maxImageBytes: 8_388_608,
    maxImagePixels: 16_000_000,
    maxAudioBytes: 5_242_880,
    maxAudioDurationMs: 10_000,
    maxTotalBytes: 268_435_456,
  },
  detail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('./avatar-tools/useLocalAvatarToolCatalog', () => ({
  useLocalAvatarToolCatalog: () => catalog,
}));

describe('AvatarToolStandaloneEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/avatar_tool_editor?mode=create');
  });

  afterEach(() => {
    document.body.classList.remove('avatar-tool-editor-page');
    vi.unstubAllGlobals();
  });

  it('renders creation in the dedicated editor page and closes on Escape', () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    render(<AvatarToolStandaloneEditor />);

    expect(screen.getByRole('dialog', { name: 'Create custom tool' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Image interaction canvas' })).toBeInTheDocument();
    expect(document.querySelector('.avatar-tool-workspace-header')).toBeNull();
    expect(document.body).toHaveClass('avatar-tool-editor-page');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
    close.mockRestore();
  });

  it('loads an existing tool directly from the shared catalog API', async () => {
    window.history.replaceState({}, '', `/avatar_tool_editor?mode=edit&toolId=${LOCAL_ID}`);
    catalog.detail.mockResolvedValue({
      id: LOCAL_ID,
      revision: '100-200',
      name: 'My Feather',
      changeMode: 'press-swap',
      defaultImage: { resource: 'default.png', url: '/user_avatar_tools/local/default.png?v=1' },
      changeItems: [{
        resource: 'change-000.png',
        url: '/user_avatar_tools/local/change-000.png?v=1',
        meaning: 'A gentle touch',
      }],
    });

    render(<AvatarToolStandaloneEditor />);

    await waitFor(() => expect(catalog.detail).toHaveBeenCalledWith(LOCAL_ID));
    expect(await screen.findByDisplayValue('My Feather')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Edit custom tool' })).toBeInTheDocument();
  });

  it('refreshes the complete editor and window title when the app locale becomes ready', async () => {
    let localeReady = false;
    const zhTranslations: Record<string, string> = {
      'chat.avatarToolCreateTitle': '创建自定义道具',
      'chat.avatarToolWorkspaceCanvasTitle': '图片交互画布',
      'chat.avatarToolWorkspaceSettings': '道具设置',
      'chat.avatarToolCreateName': '道具名称',
      'chat.avatarToolWorkspaceControls': '画布控件',
      'chat.avatarToolWorkspaceZoomIn': '放大',
      'chat.avatarToolWorkspaceZoomOut': '缩小',
      'chat.avatarToolWorkspaceFitView': '适配视图',
    };
    vi.stubGlobal('safeT', (key: string, fallback: unknown) => {
      const defaultValue = typeof fallback === 'string'
        ? fallback
        : (fallback as { defaultValue?: string }).defaultValue ?? key;
      return localeReady ? zhTranslations[key] ?? defaultValue : defaultValue;
    });

    render(<AvatarToolStandaloneEditor />);
    expect(screen.getByRole('dialog', { name: 'Create custom tool' })).toBeInTheDocument();

    localeReady = true;
    act(() => window.dispatchEvent(new Event('localechange')));

    expect(await screen.findByRole('dialog', { name: '创建自定义道具' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '图片交互画布' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '道具设置' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '道具名称' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '放大' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '缩小' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '适配视图' })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('创建自定义道具 - N.E.K.O.'));
  });
});
