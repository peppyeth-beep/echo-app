import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const URL = 'http://localhost:4001';

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(URL, { autoConnect: false });
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return socket;
};