import React, { useReducer } from 'react';
import { Box, useInput, useApp } from 'ink';
import { tuiReducer, initialState, TuiContext } from './store.js';
import { Header } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { ReviewView } from './views/ReviewView.js';
import { ConfigView } from './views/ConfigView.js';
import { SessionsView } from './views/SessionsView.js';
import { DiffView } from './views/DiffView.js';

const TAB_HINTS: Record<string, string> = {
  review:   '\u21B9 Navigate \u2502 \u23CE Start \u2502 j/k Select \u2502 ? Help \u2502 q Quit',
  config:   '\u21B9 Navigate \u2502 \u23CE Edit \u2502 t Test \u2502 ? Help \u2502 q Quit',
  sessions: '\u21B9 Navigate \u2502 e Export \u2502 f Followup \u2502 d Diff \u2502 q Quit',
  diff:     '\u21B9 Navigate \u2502 n Next \u2502 N Prev \u2502 ? Help \u2502 q Quit',
};

export function App(): React.ReactElement {
  const [state, dispatch] = useReducer(tuiReducer, initialState);
  const { exit } = useApp();

  useInput((input, key) => {
    if (state.helpVisible) {
      if (input === '?' || key.escape) dispatch({ type: 'TOGGLE_HELP' });
      return;
    }

    if (input === '1') dispatch({ type: 'SWITCH_TAB', tab: 'review' });
    if (input === '2') dispatch({ type: 'SWITCH_TAB', tab: 'config' });
    if (input === '3') dispatch({ type: 'SWITCH_TAB', tab: 'sessions' });
    if (input === '4') dispatch({ type: 'SWITCH_TAB', tab: 'diff' });

    if (input === '?') dispatch({ type: 'TOGGLE_HELP' });
    if (input === 'q') exit();

    if (key.tab) {
      dispatch({
        type: 'SET_FOCUS',
        zone: state.focusZone === 'sidebar' ? 'main' : 'sidebar',
      });
    }

    if (input === 'j') dispatch({ type: 'SIDEBAR_MOVE', delta: 1 });
    if (input === 'k') dispatch({ type: 'SIDEBAR_MOVE', delta: -1 });
  });

  const hints = TAB_HINTS[state.activeTab] ?? TAB_HINTS['review']!;

  return (
    <TuiContext.Provider value={[state, dispatch]}>
      <Box flexDirection="column" width="100%">
        <Header activeTab={state.activeTab} />
        <Box flexGrow={1}>
          {state.activeTab === 'review'   && <ReviewView />}
          {state.activeTab === 'config'   && <ConfigView />}
          {state.activeTab === 'sessions' && <SessionsView />}
          {state.activeTab === 'diff'     && <DiffView />}
        </Box>
        <StatusBar toast={state.toast} hints={hints} />
        {state.helpVisible && <HelpOverlay />}
      </Box>
    </TuiContext.Provider>
  );
}
