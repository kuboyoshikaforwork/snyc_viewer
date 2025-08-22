import {Routes, Route} from 'react-router-dom';
import MultiViewer from './pages/MultiViewer/MultiViewer';

import Viewer from './pages/Viewer/Viewer';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Viewer />} />
        <Route path="/multi" element={<MultiViewer />} />
      </Routes>
    </>
  );
}

export default App;
