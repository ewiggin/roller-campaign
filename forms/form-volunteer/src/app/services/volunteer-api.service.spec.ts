import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { VolunteerApiService } from "./volunteer-api.service";

describe("VolunteerApiService", () => {
  let service: VolunteerApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VolunteerApiService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });
});
