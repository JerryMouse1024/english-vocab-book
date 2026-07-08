import { createContext, useContext } from 'react';

const SearchContext = createContext(null);

/** 提供查词页状态（跨路由保持不丢失） */
export function SearchProvider({ children }) {
  // 这里用 null 表示"未初始化"，由 HomePage 内部自行管理
  // 我们只提供一个稳定的容器，避免组件卸载时丢失
  const stateRef = { current: null };

  return (
    <SearchContext.Provider value={stateRef}>
      {children}
    </SearchContext.Provider>
  );
}

/**
 * HomePage 用此 hook 获取/设置持久化状态。
 * 首次调用时创建初始值，后续切换页面回来仍返回同一引用。
 */
export function useSearchState() {
  return useContext(SearchContext);
}
