/**
 * Home Page Component
 * 
 * Welcome page for the test application
 */

import { Layout } from "hazo_llm_api";
import { Sidebar } from "@/components/sidebar";

export default function Home() {
  return (
    <Layout sidebar={<Sidebar />}>
      <div className="cls_home_container flex flex-col items-center justify-center h-full p-8">
        <div className="cls_home_content max-w-2xl text-center space-y-4">
          <h1 className="cls_home_title text-4xl font-bold">
            Welcome to hazo_llm_api Test App
          </h1>
          <p className="cls_home_description text-lg text-muted-foreground">
            This is a test application to demonstrate and test the hazo_llm_api package components.
          </p>
        </div>
      </div>
    </Layout>
  );
}

