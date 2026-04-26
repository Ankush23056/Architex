import { useReducer, useEffect, useRef, useState } from 'react';

const initialState = {
  elements: [],
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
    case 'DELETE_ELEMENT':
      return {
        ...state,
        elements: state.elements.filter((el) => el.id !== action.payload.id),
      };
    default:
      return state;
  }
}

export function useWhiteboardState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:3001');

    ws.current.onopen = () => setConnected(true);

    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'CANVAS_SYNC') {
          dispatch({ type: 'SYNC_STATE', payload: msg.payload });
        } else if (msg.type === 'ELEMENT_ADD') {
          dispatch({ type: 'ADD_ELEMENT', payload: msg.payload });
        } else if (msg.type === 'ELEMENT_UPDATE') {
          dispatch({ type: 'UPDATE_ELEMENT', payload: msg.payload });
        } else if (msg.type === 'ELEMENT_DELETE') {
          dispatch({ type: 'DELETE_ELEMENT', payload: msg.payload });
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.current.onclose = () => setConnected(false);

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const broadcast = (type, payload) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, payload }));
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

  const deleteElement = (id) => {
    dispatch({ type: 'DELETE_ELEMENT', payload: { id } });
    broadcast('ELEMENT_DELETE', { id });
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

  return {
    elements: state.elements,
    connected,
    addElement,
    updateElement,
    deleteElement,
    bringToFront,
    sendToBack,
  };
}
