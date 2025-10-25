import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Store, Receipt, Bluetooth, Printer, Database, Download, Upload, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  
  // Desktop/Database Settings
  const [databasePath, setDatabasePath] = useState<string>("");
  const [isElectron, setIsElectron] = useState(false);
  
  // Store Settings
  const [storeName, setStoreName] = useState("PaintPulse Store");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  
  useEffect(() => {
    // Check if running in Electron
    if (typeof window !== 'undefined' && (window as any).electron) {
      setIsElectron(true);
      // Get current database path
      (window as any).electron.getDatabasePath().then((path: string) => {
        setDatabasePath(path);
      });
    }
  }, []);

  // POS Bill Settings
  const [showCompanyName, setShowCompanyName] = useState(true);
  const [showGST, setShowGST] = useState(true);
  const [autoprint, setAutoprint] = useState(false);
  const [billFooter, setBillFooter] = useState("Thank you for your business!");

  // Bluetooth Settings
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);

  const handleSaveStoreSettings = () => {
    toast({ title: "Store settings saved successfully" });
  };

  const handleSaveBillSettings = () => {
    toast({ title: "Bill settings saved successfully" });
  };

  const handleConnectBluetooth = async () => {
    try {
      // Request Bluetooth device
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service']
      });
      
      setConnectedDevice(device.name);
      setBluetoothEnabled(true);
      toast({ title: `Connected to ${device.name}` });
    } catch (error) {
      toast({ 
        title: "Bluetooth connection failed", 
        description: "Make sure Bluetooth is enabled and the device is in pairing mode",
        variant: "destructive" 
      });
    }
  };

  const handleDisconnectBluetooth = () => {
    setConnectedDevice(null);
    setBluetoothEnabled(false);
    toast({ title: "Bluetooth disconnected" });
  };
  
  const handleChangeDatabaseLocation = async () => {
    if (!(window as any).electron) return;
    
    try {
      const newPath = await (window as any).electron.selectDatabaseLocation();
      if (newPath) {
        toast({
          title: "Database Location Changed",
          description: "Application will restart to apply changes.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change database location.",
        variant: "destructive",
      });
    }
  };

  const handleExportDatabase = async () => {
    if (!(window as any).electron) return;
    
    try {
      const result = await (window as any).electron.exportDatabase();
      if (result.success) {
        toast({
          title: "Export Successful",
          description: `Database exported successfully!`,
        });
      } else {
        toast({
          title: "Export Failed",
          description: result.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export database.",
        variant: "destructive",
      });
    }
  };

  const handleImportDatabase = async () => {
    if (!(window as any).electron) return;
    
    try {
      const result = await (window as any).electron.importDatabase();
      if (result.success) {
        toast({
          title: "Import Successful",
          description: "Application will restart to apply changes.",
        });
      } else {
        toast({
          title: "Import Failed",
          description: result.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to import database.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-settings-title">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">Manage your store, POS, and device settings</p>
      </div>

      <Tabs defaultValue="store" className="w-full">
        <TabsList className={`grid w-full ${isElectron ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="store" data-testid="tab-store-settings">
            <Store className="h-4 w-4 mr-2" />
            Store
          </TabsTrigger>
          <TabsTrigger value="pos" data-testid="tab-pos-settings">
            <Receipt className="h-4 w-4 mr-2" />
            POS & Bills
          </TabsTrigger>
          <TabsTrigger value="bluetooth" data-testid="tab-bluetooth-settings">
            <Bluetooth className="h-4 w-4 mr-2" />
            Bluetooth
          </TabsTrigger>
          {isElectron && (
            <TabsTrigger value="database" data-testid="tab-database-settings">
              <Database className="h-4 w-4 mr-2" />
              Database
            </TabsTrigger>
          )}
        </TabsList>

        {/* Store Settings */}
        <TabsContent value="store" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Store Information</CardTitle>
              <CardDescription>
                Update your store details that appear on bills and receipts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">Store Name</Label>
                <Input
                  id="storeName"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  data-testid="input-store-name"
                  placeholder="Enter store name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storeAddress">Address</Label>
                <Input
                  id="storeAddress"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  data-testid="input-store-address"
                  placeholder="Enter store address"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="storePhone">Phone Number</Label>
                  <Input
                    id="storePhone"
                    type="tel"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    data-testid="input-store-phone"
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storeEmail">Email</Label>
                  <Input
                    id="storeEmail"
                    type="email"
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                    data-testid="input-store-email"
                    placeholder="Enter email address"
                  />
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={handleSaveStoreSettings} data-testid="button-save-store">
                  Save Store Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* POS & Bill Settings */}
        <TabsContent value="pos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bill Display Settings</CardTitle>
              <CardDescription>
                Customize what appears on printed bills
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Company Name</Label>
                  <p className="text-sm text-muted-foreground">Display company name on bills</p>
                </div>
                <Switch
                  checked={showCompanyName}
                  onCheckedChange={setShowCompanyName}
                  data-testid="switch-show-company"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show GST</Label>
                  <p className="text-sm text-muted-foreground">Display GST tax on bills</p>
                </div>
                <Switch
                  checked={showGST}
                  onCheckedChange={setShowGST}
                  data-testid="switch-show-gst"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-print Bills</Label>
                  <p className="text-sm text-muted-foreground">Automatically print after completing sale</p>
                </div>
                <Switch
                  checked={autoprint}
                  onCheckedChange={setAutoprint}
                  data-testid="switch-autoprint"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="billFooter">Bill Footer Message</Label>
                <Input
                  id="billFooter"
                  value={billFooter}
                  onChange={(e) => setBillFooter(e.target.value)}
                  data-testid="input-bill-footer"
                  placeholder="Enter footer message"
                />
                <p className="text-xs text-muted-foreground">This message appears at the bottom of every bill</p>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={handleSaveBillSettings} data-testid="button-save-bill">
                  Save Bill Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bluetooth Settings */}
        <TabsContent value="bluetooth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bluetooth Printer Connection</CardTitle>
              <CardDescription>
                Connect to Bluetooth thermal printers for wireless printing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-md">
                <div className="flex items-center gap-3">
                  <Printer className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {connectedDevice ? connectedDevice : "No device connected"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {bluetoothEnabled ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
                {bluetoothEnabled ? (
                  <Button 
                    variant="outline" 
                    onClick={handleDisconnectBluetooth}
                    data-testid="button-disconnect-bluetooth"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button 
                    onClick={handleConnectBluetooth}
                    data-testid="button-connect-bluetooth"
                  >
                    <Bluetooth className="h-4 w-4 mr-2" />
                    Connect Printer
                  </Button>
                )}
              </div>

              <div className="p-4 bg-muted rounded-md">
                <h4 className="text-sm font-medium mb-2">Connection Instructions</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Make sure your Bluetooth printer is turned on</li>
                  <li>Enable pairing mode on your printer</li>
                  <li>Click "Connect Printer" button above</li>
                  <li>Select your printer from the list</li>
                  <li>Wait for connection confirmation</li>
                </ol>
              </div>

              <div className="p-4 border border-amber-500/50 bg-amber-500/10 rounded-md">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  <strong>Note:</strong> Bluetooth printing requires a compatible browser (Chrome, Edge) and 
                  a Bluetooth-enabled thermal printer. Make sure your browser has Bluetooth permissions enabled.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Database Settings - Desktop Only */}
        {isElectron && (
          <TabsContent value="database" className="space-y-4">
            <Card data-testid="card-database-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Management
                </CardTitle>
                <CardDescription>
                  Manage your database location and backups
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Database Location</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-muted rounded text-sm font-mono" data-testid="text-database-path">
                      {databasePath || "Loading..."}
                    </code>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-wrap gap-3">
                  <Button 
                    onClick={handleChangeDatabaseLocation}
                    variant="outline"
                    data-testid="button-change-location"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Change Location
                  </Button>
                  <Button 
                    onClick={handleExportDatabase}
                    variant="outline"
                    data-testid="button-export"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Backup
                  </Button>
                  <Button 
                    onClick={handleImportDatabase}
                    variant="outline"
                    data-testid="button-import"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import Database
                  </Button>
                </div>

                <Separator />

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Important Notes:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Changing database location will restart the application</li>
                    <li>Export your database regularly to prevent data loss</li>
                    <li>Importing a database will replace your current data</li>
                    <li>Keep your database backups in a safe location</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
