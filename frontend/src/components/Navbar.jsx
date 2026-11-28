import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="bg-green-600 text-white">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold">FoodRescue</Link>
        <div className="flex gap-4">
          <Link to="/">Katalog</Link>
          <Link to="/login">Login</Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar