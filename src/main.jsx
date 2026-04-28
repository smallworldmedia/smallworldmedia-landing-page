import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(useGSAP, Flip);

createRoot(document.getElementById('root')).render(
  <App />,
)
