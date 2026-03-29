"use client";

import { useContext } from "react";
import { useKiev as useKievFromProvider } from "@/components/ui/KievConfirmProvider";

export const useKiev = useKievFromProvider;
