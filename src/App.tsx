import { BrowserRouter, Route, Routes } from 'react-router'
import { Analyzer } from './pages/Analyzer'
import { BestMove } from './pages/BestMove'
import { Freestyle } from './pages/Freestyle'
import { GameReview } from './pages/GameReview'
import { PlayVsComputer } from './pages/PlayVsComputer'
import { Shell } from './ui/Shell'

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Shell>
        <Routes>
          <Route path="/" element={<Analyzer />} />
          <Route path="/best-move" element={<BestMove />} />
          <Route path="/play" element={<PlayVsComputer />} />
          <Route path="/freestyle" element={<Freestyle />} />
          <Route path="/import" element={<GameReview />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}
