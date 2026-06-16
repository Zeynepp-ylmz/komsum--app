import { AdItem } from '../api/ads';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type AppTabParamList = {
  Home: undefined;
  Messages: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  IlanOlustur:
  | undefined
  | {
    mode?: 'create' | 'edit';
    ad?: AdItem;
  };
  AllAds: undefined;
  AdminPanel: undefined;
  AdminUsers: {
    cityName: string;
    districtName: string;
    neighborhoodName: string;
    neighborhoodId: number;
  };
  AdminIlans: {
    cityName: string;
    districtName: string;
    neighborhoodName: string;
    neighborhoodId: number;
  };
  AdminUserDetail: {
    user: {
      id: number;
      ad: string;
      soyad: string;
      eposta: string;
      is_admin: boolean;
      mahalle_id: number;
      mahalle?: {
        id: number;
        ad: string;
        sehir: string;
        ilce_id?: number | null;
      } | null;
      profil_resmi: string | null;
    };
    cityName?: string;
    districtName?: string;
    neighborhoodName?: string;
  };
  EditProfile: undefined;
  ChangePassword: undefined;
  Favorites: undefined;
  MyAds: undefined;
  Comments: {
    adId: number;
    adTitle?: string;
  };
  Chat: {
    ilanId?: number;
    aliciId: number;
    aliciAdSoyad?: string;
    ilanBaslik?: string;
  };
  AdDetail: {
    adId: number;
  };
};
