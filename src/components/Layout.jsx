import { useState } from 'react'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'

export default function Layout({ children }) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="min-h-screen bg-letusBg">
      <Sidebar isOpen={isOpen} setIsOpen={setIsOpen} />
      <div className={`transition-all duration-300 ${isOpen ? 'md:ml-64' : 'md:ml-[72px]'}`}>
        <Header isOpen={isOpen} setIsOpen={setIsOpen} />
        {children}
      </div>
    </div>
  )
}
