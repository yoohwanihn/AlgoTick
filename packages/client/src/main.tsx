import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <div className="min-h-screen p-10">
      <h1 className="text-3xl font-bold text-accent">AlgoTick</h1>
      <p className="text-slate-500 mt-2">Tailwind ready · App will load in next task</p>
    </div>
  </React.StrictMode>,
);
