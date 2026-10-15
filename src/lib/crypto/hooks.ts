import { useQuery } from "@tanstack/react-query";
import {
  getCoinDetail,
  getCoinNews,
  getListings,
  getMarkets,
  getNews,
  searchCoins,
  translateNews,
} from "./api";
import { searchXPosts } from "./x-feed";

export function useMarkets() {
  return useQuery({
    queryKey: ["markets"],
    queryFn: () => getMarkets(),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

export function useNews() {
  return useQuery({
    queryKey: ["news"],
    queryFn: () => getNews(),
    staleTime: 5 * 60_000,
  });
}

export function useXSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ["x-search", q],
    queryFn: () => searchXPosts({ data: { q } }),
    enabled: enabled && q.trim().length >= 2,
    staleTime: 2 * 60_000,
  });
}

export function useCoinNews(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ["coin-news", q],
    queryFn: () => getCoinNews({ data: { q } }),
    enabled: enabled && q.trim().length >= 2,
    staleTime: 10 * 60_000,
  });
}

export function useListings() {
  return useQuery({
    queryKey: ["listings"],
    queryFn: () => getListings(),
    staleTime: 5 * 60_000,
  });
}

export function useCoinDetail(id: string, days: number) {
  return useQuery({
    queryKey: ["coin", id, days],
    queryFn: () => getCoinDetail({ data: { id, days } }),
    enabled: Boolean(id),
    staleTime: 20_000,
  });
}

export function useCoinSearch(q: string) {
  return useQuery({
    queryKey: ["search", q],
    queryFn: () => searchCoins({ data: { q } }),
    enabled: q.trim().length >= 1,
    staleTime: 60_000,
  });
}

export { translateNews };