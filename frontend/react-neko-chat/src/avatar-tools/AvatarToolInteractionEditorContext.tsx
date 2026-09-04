import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import {
  avatarToolInteractionEditorReducer,
  createAvatarToolInteractionEditorState,
  type AvatarToolInteractionEditorAction,
  type AvatarToolInteractionEditorState,
  type AvatarToolInteractionValidationIssue,
} from './avatarToolInteractionEditorModel';
import type { AvatarToolImageDraft, AvatarToolImageId } from './avatarToolEditorModel';

type AvatarToolInteractionEditorContextValue = {
  state: AvatarToolInteractionEditorState;
  dispatch: Dispatch<AvatarToolInteractionEditorAction>;
  issues: AvatarToolInteractionValidationIssue[];
  setIssues(issues: AvatarToolInteractionValidationIssue[]): void;
  imageIds: AvatarToolImageId[];
  images: AvatarToolImageDraft[];
  initialImageId: AvatarToolImageId | null;
  setImageState(images: AvatarToolImageDraft[], initialImageId: AvatarToolImageId | null): void;
  graphRevision: number;
};

const AvatarToolInteractionEditorContext = createContext<AvatarToolInteractionEditorContextValue | null>(null);

function actionChangesGraph(action: AvatarToolInteractionEditorAction): boolean {
  return action.type !== 'select-interaction'
    && action.type !== 'select-link'
    && action.type !== 'select-initial-link';
}

export function AvatarToolInteractionEditorProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(
    avatarToolInteractionEditorReducer,
    undefined,
    () => createAvatarToolInteractionEditorState(),
  );
  const [issues, setIssues] = useState<AvatarToolInteractionValidationIssue[]>([]);
  const [imageState, setImageStateValue] = useState<{
    images: AvatarToolImageDraft[];
    initialImageId: AvatarToolImageId | null;
  }>({ images: [], initialImageId: null });
  const [graphRevision, setGraphRevision] = useState(0);
  const dispatch = useCallback<Dispatch<AvatarToolInteractionEditorAction>>((action) => {
    if (actionChangesGraph(action)) {
      setIssues([]);
      setGraphRevision(revision => revision + 1);
    }
    baseDispatch(action);
  }, []);
  const setImageState = useCallback((
    images: AvatarToolImageDraft[],
    initialImageId: AvatarToolImageId | null,
  ) => {
    setImageStateValue({ images, initialImageId });
  }, []);
  const imageIds = useMemo(() => imageState.images.map(image => image.id), [imageState.images]);
  const value = useMemo(
    () => ({
      state,
      dispatch,
      issues,
      setIssues,
      imageIds,
      images: imageState.images,
      initialImageId: imageState.initialImageId,
      setImageState,
      graphRevision,
    }),
    [dispatch, graphRevision, imageIds, imageState, issues, setImageState, state],
  );

  return (
    <AvatarToolInteractionEditorContext.Provider value={value}>
      {children}
    </AvatarToolInteractionEditorContext.Provider>
  );
}

export function useAvatarToolInteractionEditor(): AvatarToolInteractionEditorContextValue {
  const value = useContext(AvatarToolInteractionEditorContext);
  if (!value) throw new Error('AvatarToolInteractionEditorProvider is required');
  return value;
}
