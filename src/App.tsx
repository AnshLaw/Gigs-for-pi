import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Tasks } from './pages/Tasks';
import { Profile } from './pages/Profile';
import { CreateTask } from './pages/CreateTask';
import { TaskDetails } from './pages/TaskDetails';
import { CreatorDashboard } from './pages/CreatorDashboard';
import { Messages } from './pages/Messages';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/:id" element={<TaskDetails />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/create-task" element={<CreateTask />} />
          <Route path="/dashboard" element={<CreatorDashboard />} />
          <Route path="/messages" element={<Messages />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;