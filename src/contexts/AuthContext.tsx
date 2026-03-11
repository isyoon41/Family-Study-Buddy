import React, {
  createContext, useContext, useState, useCallback, useEffect,
} from 'react';
import type { AuthState, Family } from '../types';
import { MOCK_CHILDREN, MOCK_PARENT, MOCK_FAMILY } from '../data/mockData';
import { addActivityLog as localAddActivity } from '../data/storage';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import * as db from '../lib/db';

const DEMO_EMAIL    = 'parent@example.com';
const DEMO_PASSWORD = 'password123';

/** 기기에 등록된 가족 ID (자녀 선택 화면에서 사용) */
export const DEVICE_FAMILY_KEY = 'fsb_device_family_id';
const SESSION_KEY = 'fsb_session';

interface AuthContextType extends AuthState {
  loginAsParent: (email: string, password: string) => Promise<{ error?: string }>;
  loginAsChild:  (childId: string, pin: string) => Promise<{ error?: string }>;
  logout: () => void;
  setupAccount: (email: string, password: string, familyName: string) => Promise<{ error?: string }>;
  hasRealAccount: () => boolean;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function loadSavedSession(): AuthState {
  try {
    const s = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
    if (s) return JSON.parse(s) as AuthState;
  } catch { /* ignore */ }
  return { role: null, parentUser: null, child: null, family: null, isDemo: false };
}

function persistSession(s: AuthState) {
  const json = JSON.stringify(s);
  sessionStorage.setItem(SESSION_KEY, json);
  // 부모 세션은 localStorage에도 저장 (탭 닫아도 유지)
  if (s.role === 'parent') localStorage.setItem(SESSION_KEY, json);
  else localStorage.removeItem(SESSION_KEY); // 자녀는 세션스토리지만
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(loadSavedSession);

  // ── Supabase Auth 상태 리스너 ────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // 이미 자녀 세션이면 건드리지 않음
    const saved = loadSavedSession();
    if (saved.role === 'child') return;

    // Supabase 세션 복원
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !state.role) {
        db.getParentProfile(session.user.id).then(result => {
          if (result) {
            const newState: AuthState = {
              role: 'parent',
              parentUser: { ...result.parent, email: session.user.email ?? '' },
              child: null,
              family: result.family,
              isDemo: false,
            };
            setState(newState);
            persistSession(newState);
            localStorage.setItem(DEVICE_FAMILY_KEY, result.family.id);
          }
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, _session) => {
        if (event === 'SIGNED_OUT') {
          clearSession();
          setState({ role: null, parentUser: null, child: null, family: null, isDemo: false });
        }
      },
    );
    return () => { subscription.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 부모 로그인 ──────────────────────────────────────────────────
  const loginAsParent = useCallback(async (email: string, password: string) => {
    // 1) 데모 계정
    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      const s: AuthState = {
        role: 'parent', parentUser: MOCK_PARENT,
        child: null, family: MOCK_FAMILY, isDemo: true,
      };
      setState(s); persistSession(s);
      localAddActivity({
        family_id: MOCK_FAMILY.id, timestamp: new Date().toISOString(),
        type: 'login_parent', actor: '부모님(데모)', description: '데모 부모님 로그인',
      });
      return {};
    }

    // 2) Supabase 실계정
    if (!isSupabaseConfigured) {
      return { error: 'Supabase 설정이 필요합니다. .env 파일을 확인해주세요.' };
    }

    const { data: authData, error: authErr } = await db.signInParent(email, password);
    if (authErr || !authData.session) {
      return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
    }

    const profile = await db.getParentProfile(authData.session.user.id);
    if (!profile) {
      return { error: '계정 정보를 찾을 수 없습니다. 관리자에게 문의하세요.' };
    }

    const s: AuthState = {
      role: 'parent',
      parentUser: { ...profile.parent, email },
      child: null, family: profile.family, isDemo: false,
    };
    setState(s); persistSession(s);
    localStorage.setItem(DEVICE_FAMILY_KEY, profile.family.id);

    // 활동 로그 (비동기, 실패해도 무시)
    db.addActivityLog(profile.family.id, 'login_parent', '부모님', '부모님 로그인')
      .catch(() => { /* noop */ });

    return {};
  }, []);

  // ── 자녀 로그인 ──────────────────────────────────────────────────
  const loginAsChild = useCallback(async (childId: string, pin: string) => {
    // 1) 데모 자녀
    const demoChild = MOCK_CHILDREN.find(c => c.id === childId);
    if (demoChild && demoChild.pin === pin) {
      // Supabase 미설정이거나 데모 자녀 ID를 가진 경우 데모 허용
      if (!isSupabaseConfigured || childId.startsWith('mock-')) {
        const s: AuthState = {
          role: 'child', parentUser: null,
          child: demoChild, family: MOCK_FAMILY, isDemo: true,
        };
        setState(s); persistSession(s);
        localAddActivity({
          family_id: MOCK_FAMILY.id, timestamp: new Date().toISOString(),
          type: 'login_child',
          actor: `${demoChild.name} ${demoChild.avatar}`,
          description: '데모 자녀 로그인',
        });
        return {};
      }
    }

    // 2) Supabase 실계정
    if (!isSupabaseConfigured) {
      return { error: '비밀번호가 틀렸어요. 다시 눌러봐요! 🔑' };
    }

    const childData = await db.verifyChildPin(childId, pin);
    if (!childData) {
      return { error: '비밀번호가 틀렸어요. 다시 눌러봐요! 🔑' };
    }

    const family: Family = { id: childData.family_id, name: '' };
    const s: AuthState = {
      role: 'child', parentUser: null,
      child: childData, family, isDemo: false,
    };
    setState(s); persistSession(s);

    db.addChildActivityLog(
      childId, pin, 'login_child',
      `${childData.name} 로그인`,
    ).catch(() => { /* noop */ });

    return {};
  }, []);

  // ── 로그아웃 ────────────────────────────────────────────────────
  const logout = useCallback(() => {
    const { family, isDemo, child, parentUser } = state;

    if (isDemo && family) {
      localAddActivity({
        family_id: family.id, timestamp: new Date().toISOString(),
        type: 'logout',
        actor: child ? `${child.name} ${child.avatar}` : (parentUser?.name ?? '부모님'),
        description: '데모 로그아웃',
      });
    } else if (!isDemo && family) {
      if (parentUser) {
        db.addActivityLog(family.id, 'logout', parentUser.name, '부모님 로그아웃')
          .catch(() => { /* noop */ });
        if (isSupabaseConfigured) db.signOutParent().catch(() => { /* noop */ });
      } else if (child) {
        db.addChildActivityLog(child.id, child.pin, 'logout', `${child.name} 로그아웃`)
          .catch(() => { /* noop */ });
      }
    }

    clearSession();
    setState({ role: null, parentUser: null, child: null, family: null, isDemo: false });
  }, [state]);

  // ── 최초 계정 생성 ───────────────────────────────────────────────
  const setupAccount = useCallback(async (
    email: string, password: string, familyName: string,
  ): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase 설정이 필요합니다. .env 파일을 확인해주세요.' };
    }

    // 1) Supabase Auth 회원가입
    const { data: signUpData, error: signUpErr } = await db.signUpParent(email, password);
    if (signUpErr || !signUpData.user) {
      return { error: signUpErr?.message ?? '회원가입 실패. 이미 사용 중인 이메일일 수 있습니다.' };
    }

    // 2) 가족 + 프로필 생성
    const result = await db.createFamilyAndProfile(
      signUpData.user.id, email, familyName,
    );
    if ('error' in result) return { error: result.error };

    const s: AuthState = {
      role: 'parent',
      parentUser: { ...result.parent, email },
      child: null, family: result.family, isDemo: false,
    };
    setState(s); persistSession(s);
    localStorage.setItem(DEVICE_FAMILY_KEY, result.family.id);

    return {};
  }, []);

  // ── 세션 갱신 (부모 재로그인 후 상태 동기화) ─────────────────────
  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured || state.isDemo) return;
    const session = await db.getSupabaseSession();
    if (!session) return;
    const profile = await db.getParentProfile(session.user.id);
    if (profile) {
      const newState: AuthState = {
        role: 'parent',
        parentUser: { ...profile.parent, email: session.user.email ?? '' },
        child: null, family: profile.family, isDemo: false,
      };
      setState(newState); persistSession(newState);
    }
  }, [state.isDemo]);

  // ── hasRealAccount: Supabase가 설정되어 있으면 true ───────────────
  const hasRealAccount = useCallback(() => isSupabaseConfigured, []);

  return (
    <AuthContext.Provider
      value={{ ...state, loginAsParent, loginAsChild, logout, setupAccount, hasRealAccount, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
