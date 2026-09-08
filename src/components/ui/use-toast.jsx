import * as React from "react"

const TOAST_LIMIT = 5
// Délai avant de retirer complètement un toast du DOM une fois fermé (le temps
// que l'animation de sortie se joue). Ne PAS confondre avec la durée d'affichage.
const TOAST_REMOVE_DELAY = 300

// Durée d'affichage par défaut avant fermeture automatique, adaptée au type :
// une erreur mérite plus de temps de lecture qu'une simple confirmation.
const DEFAULT_DURATION = 4000
const DESTRUCTIVE_DURATION = 6000

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

const toastTimeouts = new Map()
const autoDismissTimeouts = new Map()

const listeners = []
let memoryState = { toasts: [] }

function addToRemoveQueue(toastId) {
  if (toastTimeouts.has(toastId)) return
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: "REMOVE_TOAST", toastId })
  }, TOAST_REMOVE_DELAY)
  toastTimeouts.set(toastId, timeout)
}

function clearAutoDismiss(toastId) {
  const timeout = autoDismissTimeouts.get(toastId)
  if (timeout) {
    clearTimeout(timeout)
    autoDismissTimeouts.delete(toastId)
  }
}

/** Programme la fermeture automatique après `duration` ms (sauf si duration: 0/Infinity est passé explicitement). */
function scheduleAutoDismiss(toastId, duration) {
  if (duration === 0 || duration === Infinity) return
  clearAutoDismiss(toastId)
  const timeout = setTimeout(() => {
    autoDismissTimeouts.delete(toastId)
    dispatch({ type: "DISMISS_TOAST", toastId })
  }, duration)
  autoDismissTimeouts.set(toastId, timeout)
}

function reducer(state, action) {
  switch (action.type) {
    case "ADD_TOAST":
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }
    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      }
    case "DISMISS_TOAST": {
      const { toastId } = action
      if (toastId) {
        clearAutoDismiss(toastId)
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((t) => {
          clearAutoDismiss(t.id)
          addToRemoveQueue(t.id)
        })
      }
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined ? { ...t, open: false } : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return { ...state, toasts: [] }
      }
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) }
    default:
      return state
  }
}

function dispatch(action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

function toast({ duration, ...props }) {
  const id = genId()
  const resolvedDuration = duration ?? (props.variant === "destructive" ? DESTRUCTIVE_DURATION : DEFAULT_DURATION)

  const update = (props) => dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  scheduleAutoDismiss(id, resolvedDuration)

  return { id, dismiss, update }
}

function useToast() {
  const [state, setState] = React.useState(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
