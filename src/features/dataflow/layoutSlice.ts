/**
 * Computes layouts for graphs with ELK js and caches them.
 */
import {SerializedError, createAsyncThunk, createSelector, createSlice} from '@reduxjs/toolkit';
import ELK, {ElkNode} from 'elkjs';
import * as React from 'react';
import {useDispatch} from 'react-redux';
import {State} from '../../constants/default-state.js';
import {useAppSelector} from '../../hooks.js';
import {graphSelector, setRuntime} from './runtimeSlice.js';
import {visibleElementsSelector, visibleNodesSelector} from './selectionSlice.js';
import {ELKToPositions} from './utils/ELKToPositions.js';
import {createSliceSelector} from './utils/createSliceSelector.js';
import {Graph} from './utils/graph.js';
import {toELKGraph} from './utils/toELKGraph.js';

import {Worker as ElkWorker} from 'elkjs/lib/elk-worker.js';

// Mapping of action request ID to computed layout, keyed by the visible nodes and runtime

type LayoutKey = {
  // We keep the graph as a key, even though we clear all values after changing the runtime,
  // so that late returning layouts will be keyed with previous graph and wont be used
  graph: Graph | null;
  // The visible node IDs, as an array, sorted, and in JSON, for easy comparison
  visibleNodesString: string | null;
};
type Positions = Record<string, {x: number; y: number}>;
type LayoutValue = {type: 'done'; positions: Positions} | {type: 'loading'} | {type: 'error'; error: SerializedError};
type LayoutStatus = {
  key: LayoutKey;
  value: LayoutValue;
};
type LayoutState = Record<string, LayoutStatus>;

const initialState: LayoutState = {};

const elk = new ELK({
  // @ts-expect-error Worker types broken
  workerFactory: (url) => new ElkWorker(url),
});

const computeLayout = createAsyncThunk<ElkNode, void, {state: State; pendingMeta: {requestId: string; key: LayoutKey}}>(
  'computeLayout',
  (_, {getState}) => elk.layout(elkGraphSelector(getState())),
  {
    // Add key to pending metadata
    getPendingMeta: ({requestId}, {getState}) => ({requestId, key: currentLayoutKeySelector(getState())}),
    // Only run if we can't find a layout already for this key
    condition: (_node, {getState}) => !hasLayoutSelector(getState()),
  },
);
/**
 * Try recomputing layout, when either runtime or selections change
 */
export function useRecomputeLayout() {
  const dispatch = useDispatch();
  const layoutKey = useAppSelector(currentLayoutKeySelector);

  // Recompute layout whenever any key for computing it changes
  React.useEffect(() => {
    // FIXME: remove as any
    dispatch(computeLayout() as any);
  }, [layoutKey]);
}

export const layoutSlice = createSlice({
  name: 'layout',
  initialState,
  reducers: {},
  // Avoid returning builder to prevent cyclical types
  // https://github.com/reduxjs/redux-toolkit/issues/324#issuecomment-615391051
  extraReducers: (builder) => {
    builder
      .addCase(setRuntime, () => initialState)
      .addCase(computeLayout.pending, (state, action) => {
        state[action.meta.requestId] = {
          value: {type: 'loading'},
          key: action.meta.key,
        };
      })
      .addCase(computeLayout.fulfilled, (state, action) => {
        state[action.meta.requestId].value = {positions: ELKToPositions(action.payload), type: 'done'};
      })
      .addCase(computeLayout.rejected, (state, action) => {
        state[action.meta.requestId].value = {type: 'error', error: action.error};
      });
  },
});

const layoutSelector = createSliceSelector(layoutSlice);

const elkGraphSelector = createSelector(graphSelector, visibleElementsSelector, (graph, visible) =>
  graph === null ? null : toELKGraph(graph, visible),
);

function idsToString(ids: Set<string>): string {
  return [...ids].sort().join(',');
}
const visibleNodesStringSelector = createSelector(visibleNodesSelector, (nodes) =>
  nodes === null ? null : idsToString(nodes),
);

const currentLayoutKeySelector = createSelector(
  graphSelector,
  visibleNodesStringSelector,
  (graph, visibleNodesString) => ({
    graph,
    visibleNodesString,
  }),
);

const currentLayoutStatusSelector = createSelector(
  layoutSelector,
  currentLayoutKeySelector,
  (layout, {graph, visibleNodesString}) =>
    // Compare graph by identity, to speed up comparison
    Object.values(layout).find(({key}) => graph === key.graph && visibleNodesString === key.visibleNodesString) ?? null,
);

const hasLayoutSelector = createSelector(currentLayoutStatusSelector, (status) => status !== null);

export const currentLayoutSelector = createSelector(currentLayoutStatusSelector, (status) => status?.value ?? null);
export const currentPositionsSelector = createSelector(currentLayoutSelector, (value) =>
  value?.type === 'done' ? value.positions : null,
);
