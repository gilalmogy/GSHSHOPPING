// Helpers for uploading files to Firebase Storage
import { uploadBytesResumable } from '/utils/firebase.js';

/**
 * Upload a file to Firebase Storage and return the generated reference.
 * Consumers should call getDownloadURL(ref) afterwards to obtain the URL.
 */
export async function uploadFileAndGetURL(storageRef, file) {
  const uploadTask = uploadBytesResumable(storageRef, file);
  await new Promise((resolve, reject) => {
    uploadTask.on('state_changed', null, reject, resolve);
  });
  return uploadTask.snapshot.ref;
}

