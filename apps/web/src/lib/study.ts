// Personal study notes. They are kept on this device only, in the local app store, and start
// empty: nothing here is shared or sent to the server.

export interface Note {
  id: string;
  title: string;
  body: string;
  subject: string;
  updatedAt: string;
  pinned: boolean;
}
