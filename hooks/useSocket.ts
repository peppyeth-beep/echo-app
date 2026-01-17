import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

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