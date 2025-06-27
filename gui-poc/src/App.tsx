import './App.css'
import axios from 'axios'

const stopServer = () => {
  axios.get('http://localhost:3000/api/stop')
    .then(() => {
      console.log('Server stopped successfully');
    })
    .catch((error) => {
      console.error('Failed to stop server:', error);
    });
}

function App() {

  return (
    <>
      <h1>Unilogs Server Setup</h1>
      <button type="button" onClick={stopServer}>Stop Server</button>
    </>
  )
}

export default App
