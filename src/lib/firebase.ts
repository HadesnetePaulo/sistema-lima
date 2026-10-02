import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Produto, Venda, MovimentacaoCaixa, LancamentoFiado } from '../types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use the database specified in config or default
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export interface FirestoreSystemState {
  lastUpdated: string;
  produtos: Produto[];
  vendas: Venda[];
  caixa: MovimentacaoCaixa[];
  fiados: LancamentoFiado[];
}

/**
 * Validates connection to Firestore
 */
export async function testFirestoreConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const testDocRef = doc(db, 'sistema', 'ping');
    await getDocFromServer(testDocRef).catch(() => null);
    await setDoc(testDocRef, { ping: true, lastPing: new Date().toISOString() }, { merge: true });
    return { ok: true, message: 'Conectado com sucesso ao Firebase Firestore!' };
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      return { ok: false, message: 'Firebase offline. Verifique a conexão com a internet.' };
    }
    return { ok: false, message: error?.message || 'Falha ao conectar ao Firebase' };
  }
}

/**
 * Fetches the entire synchronized store from Firestore
 */
export async function fetchStateFromFirestore(): Promise<FirestoreSystemState | null> {
  try {
    const docRef = doc(db, 'sistema', 'dados_principais');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      return {
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        produtos: Array.isArray(data.produtos) ? data.produtos : [],
        vendas: Array.isArray(data.vendas) ? data.vendas : [],
        caixa: Array.isArray(data.caixa) ? data.caixa : [],
        fiados: Array.isArray(data.fiados) ? data.fiados : [],
      };
    }
    return null;
  } catch (err) {
    console.warn('[Firestore] Aviso ao buscar dados da nuvem:', err);
    return null;
  }
}

/**
 * Persists the entire store to Firestore in the cloud
 */
export async function saveStateToFirestore(state: {
  produtos: Produto[];
  vendas: Venda[];
  caixa: MovimentacaoCaixa[];
  fiados: LancamentoFiado[];
}): Promise<boolean> {
  try {
    const docRef = doc(db, 'sistema', 'dados_principais');
    const payload: FirestoreSystemState = {
      lastUpdated: new Date().toISOString(),
      produtos: state.produtos,
      vendas: state.vendas,
      caixa: state.caixa,
      fiados: state.fiados,
    };
    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Aviso ao salvar dados na nuvem:', err);
    return false;
  }
}
