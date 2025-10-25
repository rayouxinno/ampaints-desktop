import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Shield } from "lucide-react";

const SECRET_CODE = "3620192373285";

interface ActivationScreenProps {
  onActivated: () => void;
}

export default function ActivationScreen({ onActivated }: ActivationScreenProps) {
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();

  const handleActivate = async () => {
    setIsValidating(true);

    if (code.trim() === SECRET_CODE) {
      // Save activation status
      if (window.electron?.setActivationStatus) {
        await window.electron.setActivationStatus(true);
      } else {
        // Fallback for web version
        localStorage.setItem("paintpulse_activated", "true");
      }

      toast({
        title: "Software Activated! ✅",
        description: "PaintPulse successfully activated. Welcome!",
      });

      // Wait a bit for the toast to show
      setTimeout(() => {
        onActivated();
      }, 500);
    } else {
      toast({
        title: "Invalid Code ❌",
        description: "Please enter the correct activation code.",
        variant: "destructive",
      });
      setIsValidating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.trim()) {
      handleActivate();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Card className="w-full max-w-md mx-4 shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">PaintPulse Activation</CardTitle>
            <CardDescription className="mt-2">
              Enter your activation code to unlock the software
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="activation-code" className="text-sm font-medium">
              Activation Code
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="activation-code"
                type="text"
                placeholder="Enter activation code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 text-center text-lg tracking-wider"
                disabled={isValidating}
                data-testid="input-activation-code"
                autoFocus
              />
            </div>
          </div>

          <Button
            onClick={handleActivate}
            disabled={!code.trim() || isValidating}
            className="w-full"
            data-testid="button-activate"
          >
            {isValidating ? "Validating..." : "Activate Software"}
          </Button>

          <div className="text-center text-xs text-muted-foreground pt-2">
            <p>Contact your software provider if you need assistance</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
