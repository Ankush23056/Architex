import { useReducer, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const initialState = {
  elements: [],
  activeUsers: {},
  past: [],
  future: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'SYNC_STATE':
      return { ...state, elements: action.payload.elements };
    case 'ADD_ELEMENT':
      if (state.elements.some(el => el.id === action.payload.id)) return state;
      return { ...state, elements: [...state.elements, action.payload] };
    case 'UPDATE_ELEMENT':
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.id === action.payload.id ? { ...el, ...action.payload } : el
        ),
      };
    case 'UPDATE_ELEMENTS_BULK': {
      const updateMap = new Map(action.payload.map(el => [el.id, el]));
      return {
        ...state,
        elements: state.elements.map(el =>
          updateMap.has(el.id) ? { ...el, ...updateMap.get(el.id) } : el
        ),
      };
    }
    case 'DELETE_ELEMENT':
      return {
        ...state,
        elements: state.elements.filter((el) => el.id !== action.payload.id),
      };
    case 'DELETE_ELEMENTS_BULK':
      return {
        ...state,
        elements: state.elements.filter(el => !action.payload.includes(el.id)),
      };
    case 'UPDATE_CURSOR':
      return {
        ...state,
        activeUsers: {
          ...state.activeUsers,
          [action.payload.clientId]: action.payload.cursor
        }
      };
    case 'REMOVE_USER': {
      const newUsers = { ...state.activeUsers };
      delete newUsers[action.payload.clientId];
      return { ...state, activeUsers: newUsers };
    }
    case 'SAVE_HISTORY': {
      const snapshot = action.payload; // Deep copy
      const newPast = [...state.past, JSON.parse(JSON.stringify(snapshot))].slice(-50);
      return { ...state, past: newPast, future: [] };
    }
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      const newFuture = [JSON.parse(JSON.stringify(state.elements)), ...state.future];
      return { ...state, elements: previous, past: newPast, future: newFuture };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      const newPast = [...state.past, JSON.parse(JSON.stringify(state.elements))];
      return { ...state, elements: next, past: newPast, future: newFuture };
    }
    default:
      return state;
  }
}

export function useWhiteboardState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [myCallsign, setMyCallsign] = useState(null);

  useEffect(() => {
    const socket = io('http://localhost:3001');
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('message', (msg) => {
      const { type, payload, clientId } = msg;
      if (type === 'init-state' || type === 'CANVAS_SYNC') {
        if (payload?.elements) dispatch({ type: 'SYNC_STATE', payload });
      } else if (type === 'ELEMENT_ADD') {
        dispatch({ type: 'ADD_ELEMENT', payload });
      } else if (type === 'ELEMENT_UPDATE') {
        dispatch({ type: 'UPDATE_ELEMENT', payload });
      } else if (type === 'ELEMENTS_UPDATE_BULK') {
        dispatch({ type: 'UPDATE_ELEMENTS_BULK', payload });
      } else if (type === 'ELEMENT_DELETE') {
        dispatch({ type: 'DELETE_ELEMENT', payload });
      } else if (type === 'ELEMENTS_DELETE_BULK') {
        dispatch({ type: 'DELETE_ELEMENTS_BULK', payload });
      } else if (type === 'CURSOR_UPDATE') {
        dispatch({ type: 'UPDATE_CURSOR', payload: { clientId, cursor: payload } });
      } else if (type === 'USER_DISCONNECT') {
        dispatch({ type: 'REMOVE_USER', payload: { clientId } });
      } else if (type === 'IDENTITY') {
        setMyCallsign(payload.username);
      }
    });

    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  const broadcast = (type, payload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message', { type, payload });
    }
  };

  const broadcastCursor = (x, y, color) => {
    if (socketRef.current?.connected) {
      socketRef.current.volatile.emit('message', { type: 'CURSOR_UPDATE', payload: { x, y, color } });
    }
  };

  const addElement = (element) => {
    dispatch({ type: 'ADD_ELEMENT', payload: element });
    broadcast('ELEMENT_ADD', element);
  };

  const updateElement = (element) => {
    dispatch({ type: 'UPDATE_ELEMENT', payload: element });
    broadcast('ELEMENT_UPDATE', element);
  };

  const syncState = (elements) => {
    dispatch({ type: 'SYNC_STATE', payload: { elements } });
    broadcast('CANVAS_SYNC', { elements });
  };

  const wipeCanvas = () => {
    dispatch({ type: 'SYNC_STATE', payload: { elements: [] } });
    broadcast('CANVAS_CLEAR', {});
  };

  const updateElementsBulk = (elementsArray) => {
    dispatch({ type: 'UPDATE_ELEMENTS_BULK', payload: elementsArray });
    broadcast('ELEMENTS_UPDATE_BULK', elementsArray);
  };

  const deleteElement = (id) => {
    dispatch({ type: 'DELETE_ELEMENT', payload: { id } });
    broadcast('ELEMENT_DELETE', { id });
  };

  const deleteElementsBulk = (idsArray) => {
    dispatch({ type: 'DELETE_ELEMENTS_BULK', payload: idsArray });
    broadcast('ELEMENTS_DELETE_BULK', idsArray);
  };

  const bringToFront = (id) => {
    const element = state.elements.find(el => el.id === id);
    if (!element) return;
    const maxZIndex = state.elements.length > 0 ? Math.max(...state.elements.map(e => e.zIndex)) : 0;
    updateElement({ ...element, zIndex: maxZIndex + 1 });
  };

  const sendToBack = (id) => {
    const element = state.elements.find(el => el.id === id);
    if (!element) return;
    const minZIndex = state.elements.length > 0 ? Math.min(...state.elements.map(e => e.zIndex)) : 0;
    updateElement({ ...element, zIndex: minZIndex - 1 });
  };

  const saveHistory = (snapshot) => {
    dispatch({ type: 'SAVE_HISTORY', payload: snapshot || state.elements });
  };

  const undo = () => {
    if (state.past.length === 0) return;
    const previous = state.past[state.past.length - 1];
    dispatch({ type: 'UNDO' });
    broadcast('CANVAS_SYNC', { elements: previous });
  };

  const redo = () => {
    if (state.future.length === 0) return;
    const next = state.future[0];
    dispatch({ type: 'REDO' });
    broadcast('CANVAS_SYNC', { elements: next });
  };

  return {
    elements: state.elements,
    activeUsers: state.activeUsers,
    myCallsign,
    connected,
    addElement,
    updateElement,
    updateElementsBulk,
    deleteElement,
    deleteElementsBulk,
    bringToFront,
    sendToBack,
    broadcastCursor,
    saveHistory,
    undo,
    redo,
    syncState,
    wipeCanvas,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
