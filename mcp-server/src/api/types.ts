export interface AircraftInformation {
  registration_code: string;
  manufacturing_number: string;
  manufacturing_category: "1" | "2";
  aircraft_type: "1" | "2" | "3" | "4" | "5" | "6";
  manufacturer_jpn: string;
  model_jpn: string;
  manufacturer_eng: string;
  model_eng: string;
  aircraft_weight: string;
  weight_classification: "1" | "2";
  maximum_takeoff_weight: string;
  aircraft_width: string;
  aircraft_length: string;
  aircraft_height: string;
  remodeling_type: "1" | "2";
  remodeling_summary?: string;
  safety_confirmation_check1?: string;
  safety_confirmation_check2?: string;
  safety_confirmation_check3?: string;
  safety_confirmation_check4?: string;
  safety_confirmation_check5?: string;
  aircraft_status: "1" | "2" | "3";
  erase_reason_number?: string;
  erase_reason_other?: string;
  last_update_date: string;
  effectiveness_period_self: string;
  effectiveness_period_to: string;
  rid_type: "0" | "1" | "2";
  rid_manufacturer_jpn?: string;
  rid_model_jpn?: string;
  rid_manufacturer_eng?: string;
  rid_model_eng?: string;
  rid_manufacturing_number?: string;
  must_have_rid: "1" | "2";
  modified_date?: string;
  write_status: "0" | "1";
}

export interface PartyInformation {
  classification: "1" | "2";
  fullname: string;
  furigana?: string;
  corporation_number?: string;
  corporation_name?: string;
  corporation_representative_name?: string;
  country_code: string;
  prefecture_code: string;
  address: string;
  headoffice_location_country_code?: string;
  headoffice_location_prefecture_code?: string;
  headoffice_location_address?: string;
  department_name?: string;
  birthday?: string;
  country_code_tel: string;
  tel: string;
  email_address: string;
}

export interface OwnerInformation {
  owner_classification: "1" | "2";
  owner_fullname: string;
  owner_furigana?: string;
  owner_corporation_number?: string;
  owner_corporation_name?: string;
  owner_corporation_representative_name?: string;
  owner_country_code: string;
  owner_prefecture_code: string;
  owner_address: string;
  owner_headoffice_location_country_code?: string;
  owner_headoffice_location_prefecture_code?: string;
  owner_headoffice_location_address?: string;
  owner_department_name?: string;
  owner_birthday?: string;
  owner_country_code_tel: string;
  owner_tel: string;
  owner_email_address: string;
}

export interface UserInformation {
  owner_user_same_confirmation: "1" | "2";
  user_classification: "" | "1" | "9";
  user_fullname: string;
  user_furigana?: string;
  user_corporation_number?: string;
  user_corporation_name?: string;
  user_corporation_representative_name?: string;
  user_country_code: string;
  user_prefecture_code: string;
  user_address: string;
  user_headoffice_location_country_code?: string;
  user_headoffice_location_prefecture_code?: string;
  user_headoffice_location_address?: string;
  user_department_name?: string;
  user_country_code_tel: string;
  user_tel: string;
  user_email_address: string;
}

export interface AircraftRecord {
  aircraft_information: AircraftInformation;
  owner_information: OwnerInformation;
  user_information: UserInformation;
}

export const AIRCRAFT_TYPE_LABELS: Record<string, string> = {
  "1": "飛行機",
  "2": "回転翼航空機（ヘリコプター）",
  "3": "回転翼航空機（マルチローター）",
  "4": "回転翼航空機（その他）",
  "5": "滑空機",
  "6": "飛行船",
};

export const AIRCRAFT_STATUS_LABELS: Record<string, string> = {
  "1": "有効",
  "2": "無効（有効期限切れ）",
  "3": "無効（抹消済）",
};

export const RID_TYPE_LABELS: Record<string, string> = {
  "0": "なし",
  "1": "内蔵型",
  "2": "外付型",
};

export const WEIGHT_CLASSIFICATION_LABELS: Record<string, string> = {
  "1": "25kg未満",
  "2": "25kg以上",
};

export const MANUFACTURING_CATEGORY_LABELS: Record<string, string> = {
  "1": "メーカーの機体／改造した機体",
  "2": "自作した機体",
};

export const REMODELING_LABELS: Record<string, string> = {
  "1": "改造あり",
  "2": "改造なし",
};
