export type ConfigValue = {
  key: string
  val: string
}

export type PlayedSong = {
  songId: string,
  mashupSpot: number
}

export type realtimeOptions = {
  callback: Function
  table: "votes" | "config" | "songs_played" | "votes_per_song"
  event: "UPDATE" | "INSERT" | "*"
}

export type LatestVote = {
  userid: string;
  user_avatar: string;
  songid: string;
}

export type Song = {
  songId: string
  song: string
  artist: string
  cover: string
  coverPublicId: string
  length: string
  mp3: string
  presets: Array<{
    name: string
    at: number
    pc: number
  }>
  artwork: Array<{
    publicId: string
    bg: any
    cloudinaryTransform?: string
    opacity: string
    x: string
    y: string
  }>
  votes: number
  voted: boolean
  mashupSpot: number | null
  blocked?: boolean
}

export type AmpPreset = {
  pc: number;
  name: string;
  at: number;
};

export type eventReturn = {
  event: Event;
  setPlaying: Function;
  setMuted: Function;
  setVolume: Function;
};

export type Vote = {
  userid: string;
  user_avatar: string;
  songid: string;
};

export type Ball = {
  image: HTMLImageElement;
  radius: number;
  x: number;
  y: number;
  dy: number;
  dx: number;
  vel: number;
  update: Function;
};

export type events =
  | "play"
  | "pause"
  | "ended"
  | "loadeddata"
  | "waiting"
  | "playing"
  | "timeupdate"
  | "canplay"
  | "canplaythrough"
  | "statechanged"
  | "volumechange";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      config: {
        Row: {
          created_at: string
          id: number
          key: string | null
          val: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          key?: string | null
          val?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          key?: string | null
          val?: string | null
        }
        Relationships: []
      }
      songs_played: {
        Row: {
          created_at: string
          id: number
          mashup_spot: number | null
          songid: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          mashup_spot?: number | null
          songid?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          mashup_spot?: number | null
          songid?: string | null
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string | null
          email: string | null
          id: number
          mashup_spot: number | null
          soft_voted: boolean | null
          songid: string
          user_avatar: string
          userid: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: number
          mashup_spot?: number | null
          soft_voted?: boolean | null
          songid?: string
          user_avatar?: string
          userid?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: number
          mashup_spot?: number | null
          soft_voted?: boolean | null
          songid?: string
          user_avatar?: string
          userid?: string
        }
        Relationships: []
      }
    }
    Views: {
      votes_per_song: {
        Row: {
          songid: string | null
          votes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
  | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
    Database[PublicTableNameOrOptions["schema"]]["Views"])
  : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
    Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
    Database["public"]["Views"])
  ? (Database["public"]["Tables"] &
    Database["public"]["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
  | keyof Database["public"]["Tables"]
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
  : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
  | keyof Database["public"]["Tables"]
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
  : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
  | keyof Database["public"]["Enums"]
  | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
  : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
  ? Database["public"]["Enums"][PublicEnumNameOrOptions]
  : never
