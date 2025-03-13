import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
     <iframe 
        src="http://localhost:3000/d-solo/cefngwmrgqcxsa/new-dashboard?orgId=1&from=1735678800000&to=1741888765221&timezone=browser&panelId=1&__feature.dashboardSceneSolo" 
        width="450" 
        height="200" 
        frameBorder="0">
      </iframe>
    </> 
  )
}

export default App
