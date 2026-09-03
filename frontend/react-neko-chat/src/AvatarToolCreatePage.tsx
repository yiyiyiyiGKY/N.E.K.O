import {
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { i18n } from './i18n';
import AvatarToolImagePanel from './AvatarToolImagePanel';
import {
  type CreateLocalAvatarToolInput,
  type LocalAvatarToolDetail,
  type LocalAvatarToolLimits,
  type UpdateLocalAvatarToolInput,
} from './avatar-tools/localTools';
import {
  avatarToolImageEditorReducer,
  createAvatarToolImageDraft,
  createAvatarToolImageEditorState,
  getAvatarToolImageRemovalBlock,
  type AvatarToolImageId,
} from './avatar-tools/avatarToolEditorModel';
import {
  validateAvatarToolPng,
  type AvatarToolImageValidationIssue,
} from './avatar-tools/avatarToolImageFile';

type AvatarToolCreatePageProps = {
  limits: LocalAvatarToolLimits | null;
  userName?: string;
  assistantName?: string;
  initialDetail?: LocalAvatarToolDetail;
  notice?: string;
  imageReferences?: Readonly<Partial<Record<AvatarToolImageId, readonly string[]>>>;
  onSpecialEnabledChange(enabled: boolean): void;
  onSave(input: CreateLocalAvatarToolInput | UpdateLocalAvatarToolInput): Promise<void>;
  onDelete?(): Promise<void>;
  onCancel(): void;
  showCancelAction?: boolean;
};

type HostFilePickerResult = {
  cancelled?: boolean;
  error?: string;
  name?: string;
  bytes?: ArrayBuffer | ArrayBufferView;
};

type FieldErrors = Record<string, string>;

const NAME_ALLOWED_PATTERN = /^[\p{L}\p{M}\p{N} _-]+$/u;
const MEANING_CONTROL_PATTERN = /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

function normalizeToolName(value: string): string {
  return value.normalize('NFC').trim().replace(/ +/g, ' ');
}

function normalizeMeaning(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim();
}

function characterCount(value: string): number {
  return Array.from(value).length;
}

function FieldError({ message }: { message?: string }) {
  return message ? <small className="avatar-tool-create-field-error" role="alert">{message}</small> : null;
}

declare global {
  interface Window {
    nekoHost?: {
      pickImage?: (options?: { title?: string; maxBytes?: number }) => Promise<HostFilePickerResult>;
      pickAudio?: (options?: { title?: string; maxBytes?: number }) => Promise<HostFilePickerResult>;
    };
  }
}

function formatLimit(bytes: number | undefined): string {
  if (!bytes) return '';
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export default function AvatarToolCreatePage({
  limits,
  userName = '',
  assistantName = '',
  initialDetail,
  notice = '',
  imageReferences = {},
  onSpecialEnabledChange,
  onDelete,
  onCancel,
  showCancelAction = true,
}: AvatarToolCreatePageProps) {
  const editing = !!initialDetail;
  const createFieldsRef = useRef<HTMLDivElement | null>(null);
  const imageSelectionGenerationRef = useRef<Record<string, number>>({});
  const [name, setName] = useState(initialDetail?.name ?? '');
  const [imageState, dispatchImage] = useReducer(
    avatarToolImageEditorReducer,
    initialDetail,
    createAvatarToolImageEditorState,
  );
  const { images, initialImageId, selectedImageId } = imageState;
  const [normalSound, setNormalSound] = useState<File | null>(null);
  const [normalSoundResource, setNormalSoundResource] = useState(initialDetail?.normalSound?.resource);
  const [specialEnabled, setSpecialEnabled] = useState(!!initialDetail?.special);
  const [specialProbabilityPercent, setSpecialProbabilityPercent] = useState(
    Math.round((initialDetail?.special?.probability ?? 0.1) * 100),
  );
  const [specialImage, setSpecialImage] = useState<File | null>(null);
  const [specialImageResource] = useState(initialDetail?.special?.image.resource);
  const [specialMeaning, setSpecialMeaning] = useState(initialDetail?.special?.meaning ?? '');
  const [specialSound, setSpecialSound] = useState<File | null>(null);
  const [specialSoundResource, setSpecialSoundResource] = useState(initialDetail?.special?.sound?.resource);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const busy = deleting;
  const maximumImages = Math.max(1, (limits?.maxChangeImages ?? 16) + 1);
  const meaningExample = i18n(
    'chat.avatarToolCreateImageMeaningPlaceholder',
    'For example: “{{user}}” brings a lollipop to “{{character}}”, and “{{character}}” takes a bite.',
    {
      user: userName.trim() || i18n('chat.avatarToolCreateExampleUser', 'the user'),
      character: assistantName.trim() || i18n('chat.avatarToolCreateExampleCharacter', 'the character'),
    },
  );
  const specialMeaningExample = i18n(
    'chat.avatarToolCreateSpecialMeaningPlaceholder',
    'For example: “{{user}}” lightly taps “{{character}}” with a cat paw and a reward drops.',
    {
      user: userName.trim() || i18n('chat.avatarToolCreateExampleUser', 'the user'),
      character: assistantName.trim() || i18n('chat.avatarToolCreateExampleCharacter', 'the character'),
    },
  );

  const clearFieldError = (key: string) => {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const clearImageRemovalErrors = () => {
    setFieldErrors(current => Object.fromEntries(
      Object.entries(current).filter(([key]) => !key.startsWith('image_remove:')),
    ));
  };

  const setFieldError = (key: string, message: string) => {
    setFieldErrors((current) => ({ ...current, [key]: message }));
  };

  const showFieldErrors = (next: FieldErrors) => {
    setFieldErrors(next);
    const firstKey = Object.keys(next)[0];
    if (!firstKey) return;
    window.requestAnimationFrame(() => {
      const field = Array.from(
        createFieldsRef.current?.querySelectorAll<HTMLElement>('[data-error-key]') ?? [],
      ).find(candidate => candidate.dataset.errorKey === firstKey);
      if (!field) return;
      field.scrollIntoView?.({ block: 'nearest' });
      const focusTarget = field.matches('input, textarea, button')
        ? field
        : field.querySelector<HTMLElement>('input, textarea, button');
      focusTarget?.focus();
    });
  };

  const imageValidationMessage = (issue: AvatarToolImageValidationIssue) => {
    if (issue === 'too-large') {
      return i18n('chat.avatarToolCreateImageSizeError', 'The image must be no larger than {{size}}.', {
        size: formatLimit(limits?.maxImageBytes),
      });
    }
    if (issue === 'too-many-pixels') {
      return i18n(
        'chat.avatarToolCreateImagePixelsError',
        'The image dimensions are too large. Choose a PNG with no more than {{count}} total pixels.',
        { count: String(limits?.maxImagePixels ?? 16_000_000) },
      );
    }
    return i18n(
      'chat.avatarToolCreateImageInvalidError',
      'This image cannot be used. Please choose another PNG.',
    );
  };

  const validateAndAcceptImage = async (
    file: File,
    selectionKey: string,
    errorKey: string,
    accept: (file: File) => void,
  ) => {
    const generation = (imageSelectionGenerationRef.current[selectionKey] ?? 0) + 1;
    imageSelectionGenerationRef.current[selectionKey] = generation;
    const issue = await validateAvatarToolPng(file, {
      maxImageBytes: limits?.maxImageBytes ?? 8 * 1024 * 1024,
      maxImagePixels: limits?.maxImagePixels ?? 16_000_000,
    });
    if (imageSelectionGenerationRef.current[selectionKey] !== generation) return;
    if (issue) {
      setFieldError(errorKey, imageValidationMessage(issue));
      setError('');
      return;
    }
    accept(file);
    clearFieldError(errorKey);
    setError('');
  };

  const pickImageWithDesktopHost = async (
    event: ReactMouseEvent<HTMLInputElement>,
    title: string,
    selectionKey: string,
    errorKey: string,
    accept: (file: File) => void,
  ) => {
    const picker = window.nekoHost?.pickImage;
    if (!picker) return;

    event.preventDefault();
    try {
      const result = await picker({ title, maxBytes: limits?.maxImageBytes });
      if (result.cancelled) return;
      if (result.error === 'file_too_large') {
        setFieldError(errorKey, imageValidationMessage('too-large'));
        return;
      }
      if (result.error || !result.name || !result.bytes) throw new Error(result.error || 'image_picker_failed');
      const sourceBytes = result.bytes instanceof ArrayBuffer
        ? new Uint8Array(result.bytes)
        : new Uint8Array(result.bytes.buffer, result.bytes.byteOffset, result.bytes.byteLength);
      const ownedBytes = new Uint8Array(sourceBytes.byteLength);
      ownedBytes.set(sourceBytes);
      const file = new File([ownedBytes.buffer as ArrayBuffer], result.name, { type: 'image/png' });
      await validateAndAcceptImage(file, selectionKey, errorKey, accept);
    } catch {
      setFieldError(errorKey, imageValidationMessage('invalid'));
      setError('');
    }
  };

  const pickAudioWithDesktopHost = async (
    event: ReactMouseEvent<HTMLInputElement>,
    title: string,
    setFile: (file: File) => void,
    errorKey: string,
  ) => {
    const picker = window.nekoHost?.pickAudio;
    if (!picker) return;

    event.preventDefault();
    try {
      const result = await picker({ title, maxBytes: limits?.maxAudioBytes });
      if (result.cancelled) return;
      if (result.error || !result.name || !result.bytes) throw new Error(result.error || 'audio_picker_failed');
      const sourceBytes = result.bytes instanceof ArrayBuffer
        ? new Uint8Array(result.bytes)
        : new Uint8Array(result.bytes.buffer, result.bytes.byteOffset, result.bytes.byteLength);
      const ownedBytes = new Uint8Array(sourceBytes.byteLength);
      ownedBytes.set(sourceBytes);
      setFile(new File([ownedBytes.buffer as ArrayBuffer], result.name, { type: 'audio/mpeg' }));
      clearFieldError(errorKey);
      setError('');
    } catch {
      setFieldError(
        errorKey,
        i18n('chat.avatarToolCreateAudioPickError', 'Could not open this MP3. Please try another file.'),
      );
      setError('');
    }
  };

  const addImage = (file: File) => {
    dispatchImage({
      type: 'add',
      image: createAvatarToolImageDraft(file),
      maximumImages,
    });
    clearFieldError('images');
    clearFieldError('initial_image');
  };

  const replaceImage = (imageId: AvatarToolImageId, file: File) => {
    dispatchImage({ type: 'replace', imageId, file });
  };

  const updateImageMeaning = (imageId: AvatarToolImageId, meaning: string) => {
    dispatchImage({ type: 'update-meaning', imageId, meaning });
    clearFieldError(`image_meaning:${imageId}`);
    setError('');
  };

  const chooseInitialImage = (imageId: AvatarToolImageId) => {
    dispatchImage({ type: 'choose-initial', imageId });
    clearFieldError('initial_image');
    clearImageRemovalErrors();
    setError('');
  };

  const removeImage = (imageId: AvatarToolImageId) => {
    const errorKey = `image_remove:${imageId}`;
    const block = getAvatarToolImageRemovalBlock(imageState, imageId, imageReferences);
    if (block?.kind === 'initial') {
      setFieldError(errorKey, i18n(
        'chat.avatarToolCreateInitialImageRemoveError',
        'Choose another initial image before removing this one.',
      ));
      return;
    }
    if (block?.kind === 'referenced') {
      setFieldError(errorKey, i18n(
        'chat.avatarToolCreateReferencedImageRemoveError',
        'This image is used by {{locations}}. Change those image actions before removing it.',
        { locations: block.locations.join(', ') },
      ));
      return;
    }

    dispatchImage({ type: 'remove', imageId });
    setFieldErrors(current => Object.fromEntries(
      Object.entries(current).filter(([key]) => !key.endsWith(`:${imageId}`)),
    ));
    setError('');
  };

  const validateOptionalMeaning = (value: string): string => {
    const normalized = normalizeMeaning(value);
    if (!normalized) return '';
    if (characterCount(normalized) > (limits?.maxMeaningChars ?? 100)) {
      return i18n(
        'chat.avatarToolCreateOptionalMeaningLengthError',
        'The interaction description must be no more than {{count}} characters.',
        { count: String(limits?.maxMeaningChars ?? 100) },
      );
    }
    if (MEANING_CONTROL_PATTERN.test(normalized)) {
      return i18n(
        'chat.avatarToolCreateMeaningInvalidError',
        'The interaction description contains unsupported characters.',
      );
    }
    return '';
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const nextErrors: FieldErrors = {};
    const normalizedName = normalizeToolName(name);
    const maximumNameLength = limits?.maxNameChars ?? 20;
    if (!normalizedName) {
      nextErrors.name = i18n('chat.avatarToolCreateNameRequired', 'Please enter a tool name.');
    } else if (characterCount(normalizedName) > maximumNameLength) {
      nextErrors.name = i18n(
        'chat.avatarToolCreateNameLengthError',
        'The tool name must be 1–{{count}} characters.',
        { count: String(maximumNameLength) },
      );
    } else if (!NAME_ALLOWED_PATTERN.test(normalizedName)) {
      nextErrors.name = i18n(
        'chat.avatarToolCreateNameInvalidError',
        'Use letters, numbers, spaces, “-”, or “_” in the tool name.',
      );
    }
    if (images.length === 0) {
      nextErrors.images = i18n('chat.avatarToolCreateImagesRequired', 'Add at least one tool image.');
    }
    if (!initialImageId || !images.some(image => image.id === initialImageId)) {
      nextErrors.initial_image = i18n('chat.avatarToolCreateInitialImageRequired', 'Choose one initial image.');
    }
    images.forEach((image) => {
      const meaningError = validateOptionalMeaning(image.meaning);
      if (meaningError) nextErrors[`image_meaning:${image.id}`] = meaningError;
    });
    if (specialEnabled) {
      if (!specialImage && !specialImageResource) {
        nextErrors.special_image = i18n(
          'chat.avatarToolCreateSpecialImageRequired',
          'Please choose a surprise image.',
        );
      }
      const normalizedSpecialMeaning = normalizeMeaning(specialMeaning);
      if (!normalizedSpecialMeaning) {
        nextErrors.special_meaning = i18n(
          'chat.avatarToolCreateMeaningRequired',
          'Please enter an interaction description.',
        );
      } else {
        const meaningError = validateOptionalMeaning(specialMeaning);
        if (meaningError) nextErrors.special_meaning = meaningError;
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      showFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setError(i18n(
      'chat.avatarToolCreateInteractionsRequired',
      'Add at least one starting image interaction before saving.',
    ));
  };

  const removeNormalSound = () => {
    setNormalSound(null);
    setNormalSoundResource(undefined);
    clearFieldError('normal_sound');
  };

  const removeSpecialSound = () => {
    setSpecialSound(null);
    setSpecialSoundResource(undefined);
    clearFieldError('special_sound');
  };

  const deleteTool = async () => {
    if (!onDelete || busy) return;
    if (!window.confirm(i18n(
      'chat.avatarToolDeleteConfirm',
      'Delete “{{name}}”? This cannot be undone.',
      { name: initialDetail?.name ?? name },
    ))) return;
    setDeleting(true);
    setError('');
    try {
      await onDelete();
    } catch {
      setError(i18n('chat.avatarToolDeleteError', 'Could not delete this tool. Please try again.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <form className={`avatar-tool-create-page${specialEnabled ? ' has-special' : ''}`} noValidate onSubmit={submit}>
      <div className="avatar-tool-create-fields" ref={createFieldsRef}>
        {error ? <p className="avatar-tool-create-error" role="alert">{error}</p> : null}
        {notice ? (
          <p id="avatar-tool-manager-notice" className="avatar-tool-manager-notice" role="status">
            {notice}
          </p>
        ) : null}

        <label className="avatar-tool-create-field" data-error-key="name">
          <span>{i18n('chat.avatarToolCreateName', 'Tool name')}</span>
          <input
            value={name}
            aria-label={i18n('chat.avatarToolCreateName', 'Tool name')}
            aria-invalid={fieldErrors.name ? 'true' : undefined}
            disabled={busy}
            onChange={(event) => {
              setName(event.target.value);
              clearFieldError('name');
              setError('');
            }}
            placeholder={i18n(
              'chat.avatarToolCreateNamePlaceholder',
              '1–{{count}} characters; use letters, numbers, spaces, “-”, or “_”',
              { count: String(limits?.maxNameChars ?? 20) },
            )}
          />
          <FieldError message={fieldErrors.name} />
        </label>

        <AvatarToolImagePanel
          limits={limits}
          images={images}
          initialImageId={initialImageId}
          selectedImageId={selectedImageId}
          maximumImages={maximumImages}
          busy={busy}
          fieldErrors={fieldErrors}
          meaningPlaceholder={meaningExample}
          onSelectImage={imageId => dispatchImage({ type: 'select', imageId })}
          onChooseInitialImage={chooseInitialImage}
          onRemoveImage={removeImage}
          onAddImage={(file) => {
            void validateAndAcceptImage(file, 'add', 'images', addImage);
          }}
          onOpenAddImagePicker={(event, title) => {
            void pickImageWithDesktopHost(event, title, 'add', 'images', addImage);
          }}
          onReplaceImage={(imageId, file) => {
            void validateAndAcceptImage(
              file,
              `replace:${imageId}`,
              `image_file:${imageId}`,
              nextFile => replaceImage(imageId, nextFile),
            );
          }}
          onOpenReplaceImagePicker={(event, imageId, title) => {
            void pickImageWithDesktopHost(
              event,
              title,
              `replace:${imageId}`,
              `image_file:${imageId}`,
              file => replaceImage(imageId, file),
            );
          }}
          onUpdateMeaning={updateImageMeaning}
        />

        <div className="avatar-tool-create-field avatar-tool-create-audio-field" data-error-key="normal_sound">
          <span>{i18n('chat.avatarToolCreateNormalSound', 'Interaction sound (optional)')}</span>
          <div className="avatar-tool-create-file-row">
            <label className={`avatar-tool-create-file-control${busy ? ' is-disabled' : ''}`}>
              <input
                className="avatar-tool-create-file-input"
                type="file"
                accept="audio/mpeg,.mp3"
                aria-label={i18n('chat.avatarToolCreateNormalSound', 'Interaction sound (optional)')}
                disabled={busy}
                onClick={(event) => {
                  void pickAudioWithDesktopHost(
                    event,
                    i18n('chat.avatarToolCreateNormalSound', 'Interaction sound (optional)'),
                    setNormalSound,
                    'normal_sound',
                  );
                }}
                onChange={(event) => {
                  setNormalSound(event.target.files?.[0] ?? null);
                  clearFieldError('normal_sound');
                }}
              />
              <span className="avatar-tool-create-file-button">
                {normalSound || normalSoundResource
                  ? i18n('chat.avatarToolUpdateChooseAudio', 'Change MP3')
                  : i18n('chat.avatarToolCreateChooseAudio', 'Choose MP3')}
              </span>
              <span className={`avatar-tool-create-file-name${normalSound || normalSoundResource ? ' has-file' : ''}`}>
                {normalSound?.name
                  ?? (normalSoundResource
                    ? i18n('chat.avatarToolUpdateCurrentAudio', 'Current sound')
                    : i18n('chat.avatarToolCreateNoAudio', 'No sound selected'))}
              </span>
            </label>
            {normalSound || normalSoundResource ? (
              <button className="avatar-tool-create-remove-file" type="button" disabled={busy} onClick={removeNormalSound}>
                {i18n('chat.avatarToolUpdateRemoveAudio', 'Remove')}
              </button>
            ) : null}
          </div>
          <small>
            {i18n('chat.avatarToolCreateNormalSoundHint', 'Played once when an interaction succeeds.')}
            {limits ? ` ${i18n('chat.avatarToolCreateAudioLimit', 'MP3, up to {{size}} and {{seconds}} seconds', {
              size: formatLimit(limits.maxAudioBytes),
              seconds: String(Math.round(limits.maxAudioDurationMs / 1000)),
            })}` : ''}
          </small>
          <FieldError message={fieldErrors.normal_sound} />
        </div>

        <section className={`avatar-tool-create-special${specialEnabled ? ' is-enabled' : ''}`}>
          <label className="avatar-tool-create-special-toggle">
            <span>{i18n('chat.avatarToolCreateSpecial', 'Surprise')}</span>
            <input
              type="checkbox"
              checked={specialEnabled}
              disabled={busy}
              onChange={(event) => {
                const enabled = event.target.checked;
                setSpecialEnabled(enabled);
                onSpecialEnabledChange(enabled);
                if (enabled) {
                  window.requestAnimationFrame(() => {
                    const fields = createFieldsRef.current;
                    if (fields && fields.scrollHeight > fields.clientHeight) fields.scrollTop = fields.scrollHeight;
                  });
                } else {
                  setFieldErrors(current => Object.fromEntries(
                    Object.entries(current).filter(([key]) => !key.startsWith('special_')),
                  ));
                }
                setError('');
              }}
            />
            <span className="avatar-tool-create-special-switch" aria-hidden="true" />
          </label>

          {specialEnabled ? (
            <div className="avatar-tool-create-special-fields">
              <label className="avatar-tool-create-field avatar-tool-create-special-probability" data-error-key="special_probability">
                <span>{i18n('chat.avatarToolCreateSpecialProbability', 'Trigger chance')}</span>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={specialProbabilityPercent}
                  aria-valuetext={`${specialProbabilityPercent}%`}
                  disabled={busy}
                  onChange={(event) => {
                    setSpecialProbabilityPercent(Number(event.target.value));
                    clearFieldError('special_probability');
                  }}
                />
                <strong>{specialProbabilityPercent}%</strong>
              </label>
              <FieldError message={fieldErrors.special_probability} />

              <div className="avatar-tool-create-field" data-error-key="special_image">
                <span>{i18n('chat.avatarToolCreateSpecialImage', 'Surprise image')}</span>
                <label className={`avatar-tool-create-file-control${busy ? ' is-disabled' : ''}`} aria-invalid={fieldErrors.special_image ? 'true' : undefined}>
                  <input
                    className="avatar-tool-create-file-input"
                    type="file"
                    accept="image/png,.png"
                    aria-label={i18n('chat.avatarToolCreateSpecialImage', 'Surprise image')}
                    disabled={busy}
                    onClick={(event) => {
                      void pickImageWithDesktopHost(
                        event,
                        i18n('chat.avatarToolCreateSpecialImage', 'Surprise image'),
                        'special',
                        'special_image',
                        setSpecialImage,
                      );
                    }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) void validateAndAcceptImage(file, 'special', 'special_image', setSpecialImage);
                    }}
                  />
                  <span className="avatar-tool-create-file-button">
                    {specialImage || specialImageResource
                      ? i18n('chat.avatarToolUpdateChooseImage', 'Change image')
                      : i18n('chat.avatarToolCreateChooseImage', 'Choose image')}
                  </span>
                  <span className={`avatar-tool-create-file-name${specialImage || specialImageResource ? ' has-file' : ''}`}>
                    {specialImage?.name
                      ?? (specialImageResource
                        ? i18n('chat.avatarToolUpdateCurrentImage', 'Current image')
                        : i18n('chat.avatarToolCreateNoImage', 'No image selected'))}
                  </span>
                </label>
                <FieldError message={fieldErrors.special_image} />
              </div>

              <label className="avatar-tool-create-field avatar-tool-create-special-meaning" data-error-key="special_meaning">
                <span>{i18n('chat.avatarToolCreateImageMeaning', 'Interaction description')}</span>
                <textarea
                  value={specialMeaning}
                  aria-invalid={fieldErrors.special_meaning ? 'true' : undefined}
                  disabled={busy}
                  onChange={(event) => {
                    setSpecialMeaning(event.target.value);
                    clearFieldError('special_meaning');
                  }}
                  placeholder={specialMeaningExample}
                  rows={3}
                />
                <FieldError message={fieldErrors.special_meaning} />
              </label>

              <div className="avatar-tool-create-field" data-error-key="special_sound">
                <span>{i18n('chat.avatarToolCreateSpecialSound', 'Surprise sound (optional)')}</span>
                <div className="avatar-tool-create-file-row">
                  <label className={`avatar-tool-create-file-control${busy ? ' is-disabled' : ''}`}>
                    <input
                      className="avatar-tool-create-file-input"
                      type="file"
                      accept="audio/mpeg,.mp3"
                      aria-label={i18n('chat.avatarToolCreateSpecialSound', 'Surprise sound (optional)')}
                      disabled={busy}
                      onClick={(event) => {
                        void pickAudioWithDesktopHost(
                          event,
                          i18n('chat.avatarToolCreateSpecialSound', 'Surprise sound (optional)'),
                          setSpecialSound,
                          'special_sound',
                        );
                      }}
                      onChange={(event) => {
                        setSpecialSound(event.target.files?.[0] ?? null);
                        clearFieldError('special_sound');
                      }}
                    />
                    <span className="avatar-tool-create-file-button">
                      {specialSound || specialSoundResource
                        ? i18n('chat.avatarToolUpdateChooseAudio', 'Change MP3')
                        : i18n('chat.avatarToolCreateChooseAudio', 'Choose MP3')}
                    </span>
                    <span className={`avatar-tool-create-file-name${specialSound || specialSoundResource ? ' has-file' : ''}`}>
                      {specialSound?.name
                        ?? (specialSoundResource
                          ? i18n('chat.avatarToolUpdateCurrentAudio', 'Current sound')
                          : i18n('chat.avatarToolCreateNoAudio', 'No sound selected'))}
                    </span>
                  </label>
                  {specialSound || specialSoundResource ? (
                    <button className="avatar-tool-create-remove-file" type="button" disabled={busy} onClick={removeSpecialSound}>
                      {i18n('chat.avatarToolUpdateRemoveAudio', 'Remove')}
                    </button>
                  ) : null}
                </div>
                <FieldError message={fieldErrors.special_sound} />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className={`avatar-tool-manager-actions avatar-tool-create-actions${editing ? ' is-editing' : ''}`}>
        {editing && onDelete ? (
          <button className="avatar-tool-manager-action danger" type="button" disabled={busy} onClick={() => void deleteTool()}>
            {deleting
              ? i18n('chat.avatarToolUpdateDeleting', 'Deleting…')
              : i18n('chat.avatarToolUpdateDelete', 'Delete tool')}
          </button>
        ) : null}
        <div className="avatar-tool-create-action-group">
          {showCancelAction ? (
            <button className="avatar-tool-manager-action secondary" type="button" disabled={busy} onClick={onCancel}>
              {i18n('chat.avatarToolCreateBack', 'Back')}
            </button>
          ) : null}
          <button className="avatar-tool-manager-action primary" type="submit" disabled={busy}>
            {editing
              ? i18n('chat.avatarToolUpdateSave', 'Save changes')
              : i18n('chat.avatarToolCreateSave', 'Save tool')}
          </button>
        </div>
      </div>
    </form>
  );
}
