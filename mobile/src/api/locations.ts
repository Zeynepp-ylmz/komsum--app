import { apiClient } from './client';

export type CityItem = {
  id: number;
  ad: string;
};

export type DistrictItem = {
  id: number;
  ad: string;
  il_id: number;
};

export type NeighborhoodItem = {
  id: number;
  ad: string;
  sehir: string;
  ilce_id?: number | null;
};

export async function getCities() {
  const response = await apiClient.get<CityItem[]>('/locations/cities');
  return response.data;
}

export async function getDistricts(cityId: number) {
  const response = await apiClient.get<DistrictItem[]>('/locations/districts', {
    params: { city_id: cityId },
  });
  return response.data;
}

export async function getNeighborhoods(districtId: number) {
  const response = await apiClient.get<NeighborhoodItem[]>('/locations/neighborhoods', {
    params: { district_id: districtId },
  });
  return response.data;
}
