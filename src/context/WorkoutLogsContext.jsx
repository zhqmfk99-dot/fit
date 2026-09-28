import { createContext, useContext, useState } from 'react'
import { workoutLogs as initialLogs, routines as initialRoutines, exerciseCatalog as initialExercises } from '../mockData.js'

const WorkoutLogsContext = createContext(null)

export function WorkoutLogsProvider({ children }) {
  const [logs, setLogs] = useState(initialLogs)
  const [routines, setRoutines] = useState(initialRoutines)
  const [exercises, setExercises] = useState(initialExercises)
  return (
    <WorkoutLogsContext.Provider value={{ logs, setLogs, routines, setRoutines, exercises, setExercises }}>
      {children}
    </WorkoutLogsContext.Provider>
  )
}

export function useWorkoutLogs() {
  const ctx = useContext(WorkoutLogsContext)
  if (!ctx) throw new Error('useWorkoutLogs must be used within WorkoutLogsProvider')
  return ctx
}
