import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ExampleItemsPage from './pages/ExampleItemsPage'; // @demo
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <main className="app-shell">
        <div className="app-glow app-glow-left" aria-hidden="true" />
        <div className="app-glow app-glow-right" aria-hidden="true" />

        <section className="app-frame">
          <header className="hero">
            <p className="hero-kicker">Fastify + React Starter</p>
            <h1>Reusable Full-Stack Template</h1>
            <p className="hero-copy">
              A generic baseline with Fastify serving the built React app, optional Sequelize setup,
              and one small example feature to replace with your real domain.
            </p>
          </header>

          <nav className="app-nav" aria-label="Primary">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'app-nav-link active' : 'app-nav-link'}>
              Overview
            </NavLink>
            {/* @demo-start */}
            <NavLink to="/items" className={({ isActive }) => isActive ? 'app-nav-link active' : 'app-nav-link'}>
              Example Items
            </NavLink>
            {/* @demo-end */}
          </nav>

          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/items" element={<ExampleItemsPage />} /> {/* @demo */}
          </Routes>
        </section>
      </main>
    </BrowserRouter>
  );
}
