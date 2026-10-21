
import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('http://localhost:5001/products')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch products')
        }

        return response.json()
      })
      .then((data) => {
        setProducts(data)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching products:', error)
        setError('Products load nahi ho paaye. Backend server check karo.')
        setLoading(false)
      })
  }, [])



const filteredProducts = products.filter((product) => {
  const matchesSearch = product.name
    .toLowerCase()
    .includes(search.toLowerCase())

  const matchesCategory =
    category === 'All' || product.category === category

  return matchesSearch && matchesCategory
})
  return (
    <div className="app">
      <header className="header">
        <h2>GeM Price Compare</h2>
        <span>Smart Shopping for Government Procurement</span>
      </header>

      <main className="main">
        <h1>Compare Product Prices</h1>

        <p>
          Compare GeM prices with other marketplaces in one place.
        </p>

        <input
          type="text"
          placeholder="Search a product, e.g. Wireless Mouse"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="All">All Categories</option>
          <option value="Computer Accessories">
            Computer Accessories
          </option>
          <option value="Office Furniture">
            Office Furniture
          </option>
        </select> 


        {loading && <p>Loading products...</p>}

        {error && <p>{error}</p>}

        {!loading && !error && (
          <div className="products">
            {filteredProducts.map((product) => (
              <div className="product-card" key={product.id}>
                <h3>{product.name}</h3>

                <p>{product.category}</p>

                <div className="price-row">
                  <span>GeM Price</span>
                  <strong>₹{product.gemPrice}</strong>
                </div>

                <div className="price-row">
                  <span>Other Marketplace</span>
                  <strong>₹{product.otherPrice}</strong>
                </div>

                            
              <div className="result">
                {product.gemPrice === product.otherPrice
                  ? 'Both prices are equal'
                  : product.gemPrice < product.otherPrice
                    ? `GeM is cheaper by ₹${
                        product.otherPrice - product.gemPrice
                      } (${(
                        ((product.otherPrice - product.gemPrice) /
                          product.otherPrice) *
                        100
                      ).toFixed(1)}%)`
                    : `Other marketplace is cheaper by ₹${
                        product.gemPrice - product.otherPrice
                      } (${(
                        ((product.gemPrice - product.otherPrice) /
                          product.gemPrice) *
                        100
                      ).toFixed(1)}%)`}
              </div>
              </div>
            ))}

            {filteredProducts.length === 0 && (
              <p>No matching products found.</p>
            )}
          </div>
        )}

        <p className="note">
          Demo data only — prices are sample values, not live marketplace prices.
        </p>
      </main>
    </div>
  )
}

export default App
